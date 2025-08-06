-- Updated calculate_daily_schedules function with proper sequential scheduling
CREATE OR REPLACE FUNCTION public.calculate_daily_schedules(
  p_start_date date DEFAULT CURRENT_DATE + INTERVAL '1 day', 
  p_end_date date DEFAULT (CURRENT_DATE + INTERVAL '15 days'), 
  p_calculation_type text DEFAULT 'nightly_full'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  calc_run_id uuid := gen_random_uuid();
  start_time timestamp := now();
  jobs_processed_count integer := 0;
  stages_affected_count integer := 0;
  processing_date date;
  job_record RECORD;
  stage_record RECORD;
  current_time_minutes integer := 480; -- 8:00 AM in minutes from midnight
  stage_completion_time integer;
  next_stage_start_time integer;
  daily_capacity_minutes integer := 510; -- 8.5 hours
  effective_capacity_minutes integer := 480; -- 8 hours after lunch
  debug_msg text;
BEGIN
  -- Ensure we start from next business day
  IF EXTRACT(DOW FROM p_start_date) = 0 THEN -- Sunday
    p_start_date := p_start_date + INTERVAL '1 day'; -- Move to Monday
  ELSIF EXTRACT(DOW FROM p_start_date) = 6 THEN -- Saturday  
    p_start_date := p_start_date + INTERVAL '2 days'; -- Move to Monday
  END IF;

  -- Log calculation start
  INSERT INTO public.schedule_calculation_log (
    calculation_run_id, calculation_type, trigger_reason, started_at, created_by
  ) VALUES (
    calc_run_id, p_calculation_type, 'Sequential workflow scheduling starting 8AM', start_time, auth.uid()
  );

  debug_msg := format('Starting sequential scheduling from %s to %s, type: %s', p_start_date, p_end_date, p_calculation_type);
  RAISE NOTICE '%', debug_msg;

  -- Clear existing future schedules for the date range
  DELETE FROM public.job_schedule_assignments 
  WHERE scheduled_date >= p_start_date AND scheduled_date <= p_end_date;
  
  RAISE NOTICE 'Cleared schedule assignments for date range % to %', p_start_date, p_end_date;

  -- Get all pending jobs ordered by priority (expedited first, then by created date)
  processing_date := p_start_date;
  current_time_minutes := 480; -- Start at 8:00 AM

  FOR job_record IN
    SELECT DISTINCT 
      jsi.job_id, 
      jsi.job_table_name,
      COUNT(jsi.id) as total_stages,
      CASE WHEN pj.is_expedited THEN 0 ELSE 100 END as priority_score,
      COALESCE(pj.is_expedited, false) as is_expedited,
      pj.created_at
    FROM public.job_stage_instances jsi
    LEFT JOIN public.production_jobs pj ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
    WHERE jsi.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM public.job_schedule_assignments jsa
        WHERE jsa.job_id = jsi.job_id 
          AND jsa.production_stage_id = jsi.production_stage_id
          AND jsa.status = 'scheduled'
      )
    GROUP BY jsi.job_id, jsi.job_table_name, pj.is_expedited, pj.created_at
    ORDER BY priority_score ASC, pj.created_at ASC
    LIMIT 50 -- Process in reasonable batches
  LOOP
    jobs_processed_count := jobs_processed_count + 1;
    
    -- Schedule all stages for this job sequentially
    FOR stage_record IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.production_stage_id,
        ps.name as stage_name,
        jsi.stage_order,
        COALESCE(jsi.estimated_duration_minutes, 120) as duration_minutes,
        COALESCE(scp.daily_capacity_hours * 60, effective_capacity_minutes) as stage_capacity_minutes,
        COALESCE(scp.efficiency_factor, 0.85) as efficiency_factor
      FROM public.job_stage_instances jsi
      JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
      LEFT JOIN public.stage_capacity_profiles scp ON ps.id = scp.production_stage_id
      WHERE jsi.job_id = job_record.job_id 
        AND jsi.job_table_name = job_record.job_table_name
        AND jsi.status = 'pending'
      ORDER BY jsi.stage_order ASC
    LOOP
      stages_affected_count := stages_affected_count + 1;
      
      -- Check if we need to move to next business day
      WHILE processing_date <= p_end_date LOOP
        -- Skip weekends
        IF EXTRACT(DOW FROM processing_date) BETWEEN 1 AND 5 
           AND NOT public.is_public_holiday(processing_date) THEN
          
          -- Check if stage fits in remaining capacity for this day
          IF current_time_minutes + stage_record.duration_minutes <= (480 + 510) THEN -- End of business day
            -- Schedule the stage
            INSERT INTO public.job_schedule_assignments (
              job_id, job_table_name, production_stage_id, scheduled_date,
              queue_position, shift_number, estimated_duration_minutes, 
              priority_score, is_expedited, calculation_run_id, status
            ) VALUES (
              job_record.job_id, job_record.job_table_name, stage_record.production_stage_id, 
              processing_date, 1, 1, stage_record.duration_minutes,
              job_record.priority_score, job_record.is_expedited, calc_run_id, 'scheduled'
            );

            -- Ensure daily schedule record exists
            INSERT INTO public.daily_production_schedule (
              date, production_stage_id, total_capacity_minutes, allocated_minutes, shift_number
            ) VALUES (
              processing_date, stage_record.production_stage_id, 
              FLOOR(stage_record.stage_capacity_minutes * stage_record.efficiency_factor), 
              stage_record.duration_minutes, 1
            ) ON CONFLICT (date, production_stage_id, shift_number) 
            DO UPDATE SET 
              allocated_minutes = daily_production_schedule.allocated_minutes + stage_record.duration_minutes,
              updated_at = now();

            -- Calculate when this stage will complete
            stage_completion_time := current_time_minutes + stage_record.duration_minutes;
            
            -- Next stage starts immediately after this one completes (if same day)
            IF stage_completion_time <= 990 THEN -- Before 4:30 PM (16:30)
              current_time_minutes := stage_completion_time;
            ELSE
              -- Move to next business day, start at 8:00 AM
              processing_date := processing_date + INTERVAL '1 day';
              current_time_minutes := 480; -- 8:00 AM
              CONTINUE; -- Re-check if next day is business day
            END IF;

            RAISE NOTICE 'Scheduled job % stage % (%s) on % at %s', 
              job_record.job_id, stage_record.stage_name, stage_record.production_stage_id,
              processing_date, (current_time_minutes / 60)::text || ':' || LPAD(((current_time_minutes % 60)::text), 2, '0');
            
            EXIT; -- Move to next stage
          ELSE
            -- No capacity left today, move to next business day
            processing_date := processing_date + INTERVAL '1 day';
            current_time_minutes := 480; -- Start at 8:00 AM
          END IF;
        ELSE
          -- Skip non-working day
          processing_date := processing_date + INTERVAL '1 day';
        END IF;
      END LOOP;
      
      -- Break if we've exceeded the end date
      IF processing_date > p_end_date THEN
        EXIT;
      END IF;
    END LOOP;
    
    -- Break if we've exceeded the end date
    IF processing_date > p_end_date THEN
      EXIT;
    END IF;
  END LOOP;

  -- Update completion log
  UPDATE public.schedule_calculation_log
  SET completed_at = now(),
      jobs_processed = jobs_processed_count,
      stages_affected = stages_affected_count,
      execution_time_ms = EXTRACT(EPOCH FROM (now() - start_time)) * 1000
  WHERE calculation_run_id = calc_run_id;

  RAISE NOTICE 'Sequential scheduling completed: % jobs processed, % stages affected', jobs_processed_count, stages_affected_count;

  RETURN jsonb_build_object(
    'success', true,
    'calculation_run_id', calc_run_id,
    'jobs_processed', jobs_processed_count,
    'stages_affected', stages_affected_count,
    'sequential_scheduling_info', jsonb_build_object(
      'start_time', '8:00 AM',
      'working_days', 'Monday-Friday',
      'logic', 'Sequential stage scheduling with immediate progression'
    ),
    'date_range', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    )
  );
END;
$function$;