-- Fix the scheduling system by creating the missing function and fixing the database functions

-- 1. Create the missing is_public_holiday function that is referenced in calculate_daily_schedules
CREATE OR REPLACE FUNCTION public.is_public_holiday(check_date date)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.public_holidays 
    WHERE date = check_date AND is_active = true
  );
END;
$function$;

-- 2. Fix the calculate_daily_schedules function to properly handle working hours and debugging
CREATE OR REPLACE FUNCTION public.calculate_daily_schedules(p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT (CURRENT_DATE + '14 days'::interval), p_calculation_type text DEFAULT 'nightly_full'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  calc_run_id uuid := gen_random_uuid();
  start_time timestamp := now();
  jobs_processed integer := 0;
  stages_affected integer := 0;
  processing_date date;
  stage_record RECORD;
  job_record RECORD;
  daily_capacity_minutes integer;
  current_allocation integer;
  queue_position integer;
  working_hours_per_day integer := 510; -- 8.5 hours (8am-4:30pm) = 510 minutes
  lunch_break_minutes integer := 30;
  effective_capacity_minutes integer := 480; -- 510 - 30 = 480 minutes (8 hours)
  debug_msg text;
BEGIN
  -- Log calculation start
  INSERT INTO public.schedule_calculation_log (
    calculation_run_id, calculation_type, trigger_reason, started_at, created_by
  ) VALUES (
    calc_run_id, p_calculation_type, 'Working hours scheduling calculation', start_time, auth.uid()
  );

  debug_msg := format('Starting calculation from %s to %s, type: %s', p_start_date, p_end_date, p_calculation_type);
  RAISE NOTICE '%', debug_msg;

  -- Clear existing future schedules (keep current day and past)
  DELETE FROM public.job_schedule_assignments 
  WHERE scheduled_date > CURRENT_DATE;
  
  RAISE NOTICE 'Cleared future schedule assignments';

  -- Process each date in the range
  processing_date := p_start_date;
  WHILE processing_date <= p_end_date LOOP
    -- Only process Monday-Friday working days (1=Monday, 5=Friday)
    -- Skip weekends (Saturday=6, Sunday=0) and holidays
    IF EXTRACT(DOW FROM processing_date) BETWEEN 1 AND 5 
       AND NOT public.is_public_holiday(processing_date) THEN
      
      RAISE NOTICE 'Processing working day: %', processing_date;
      
      -- Process each active production stage
      FOR stage_record IN
        SELECT ps.id, ps.name, 
               COALESCE(scp.daily_capacity_hours * 60, effective_capacity_minutes) as capacity_minutes,
               COALESCE(scp.efficiency_factor, 0.85) as efficiency_factor
        FROM public.production_stages ps
        LEFT JOIN public.stage_capacity_profiles scp ON ps.id = scp.production_stage_id
        WHERE ps.is_active = true
        ORDER BY ps.order_index
      LOOP
        stages_affected := stages_affected + 1;
        -- Apply efficiency factor to get realistic capacity
        daily_capacity_minutes := FLOOR(stage_record.capacity_minutes * stage_record.efficiency_factor);
        current_allocation := 0;
        queue_position := 1;

        RAISE NOTICE 'Processing stage: % with capacity: % minutes', stage_record.name, daily_capacity_minutes;

        -- Ensure daily schedule record exists with working hours capacity
        INSERT INTO public.daily_production_schedule (
          date, production_stage_id, total_capacity_minutes, allocated_minutes, shift_number
        ) VALUES (
          processing_date, stage_record.id, daily_capacity_minutes, 0, 1
        ) ON CONFLICT (date, production_stage_id, shift_number) 
        DO UPDATE SET 
          total_capacity_minutes = EXCLUDED.total_capacity_minutes,
          updated_at = now();

        -- Schedule pending jobs for this stage on this date
        FOR job_record IN
          SELECT DISTINCT jsi.job_id, jsi.job_table_name, 
                 COALESCE(jsi.estimated_duration_minutes, 120) as duration_minutes,
                 CASE WHEN pj.is_expedited THEN 0 ELSE 100 END as priority_score,
                 COALESCE(pj.is_expedited, false) as is_expedited
          FROM public.job_stage_instances jsi
          LEFT JOIN public.production_jobs pj ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
          WHERE jsi.production_stage_id = stage_record.id
            AND jsi.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM public.job_schedule_assignments jsa
              WHERE jsa.job_id = jsi.job_id 
                AND jsa.production_stage_id = stage_record.id
                AND jsa.status = 'scheduled'
            )
          ORDER BY priority_score ASC, jsi.created_at ASC
          LIMIT 50 -- Process in batches to avoid timeouts
        LOOP
          -- Check if job fits in remaining capacity
          IF current_allocation + job_record.duration_minutes <= daily_capacity_minutes THEN
            -- Schedule the job
            INSERT INTO public.job_schedule_assignments (
              job_id, job_table_name, production_stage_id, scheduled_date,
              queue_position, estimated_duration_minutes, priority_score, 
              is_expedited, calculation_run_id
            ) VALUES (
              job_record.job_id, job_record.job_table_name, stage_record.id, processing_date,
              queue_position, job_record.duration_minutes, job_record.priority_score,
              job_record.is_expedited, calc_run_id
            );

            current_allocation := current_allocation + job_record.duration_minutes;
            queue_position := queue_position + 1;
            jobs_processed := jobs_processed + 1;
            
            RAISE NOTICE 'Scheduled job % for stage % on % at position %', 
              job_record.job_id, stage_record.name, processing_date, queue_position - 1;
          ELSE
            -- Capacity full, move to next date
            RAISE NOTICE 'Capacity full for stage % on %, moving to next date', stage_record.name, processing_date;
            EXIT;
          END IF;
        END LOOP;

        -- Update daily schedule allocation
        UPDATE public.daily_production_schedule
        SET allocated_minutes = current_allocation, updated_at = now()
        WHERE date = processing_date 
          AND production_stage_id = stage_record.id 
          AND shift_number = 1;
      END LOOP;
    ELSE
      RAISE NOTICE 'Skipping non-working day: % (DOW: %)', processing_date, EXTRACT(DOW FROM processing_date);
    END IF;
    
    processing_date := processing_date + INTERVAL '1 day';
  END LOOP;

  -- Log completion
  UPDATE public.schedule_calculation_log
  SET completed_at = now(),
      jobs_processed = calculate_daily_schedules.jobs_processed,
      stages_affected = calculate_daily_schedules.stages_affected,
      execution_time_ms = EXTRACT(EPOCH FROM (now() - start_time)) * 1000
  WHERE calculation_run_id = calc_run_id;

  RAISE NOTICE 'Calculation completed: % jobs processed, % stages affected', jobs_processed, stages_affected;

  RETURN jsonb_build_object(
    'success', true,
    'calculation_run_id', calc_run_id,
    'jobs_processed', jobs_processed,
    'stages_affected', stages_affected,
    'working_hours_info', jsonb_build_object(
      'daily_capacity_minutes', effective_capacity_minutes,
      'working_days', 'Monday-Friday',
      'working_hours', '8:00am-4:30pm',
      'lunch_break_minutes', lunch_break_minutes
    ),
    'date_range', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    )
  );
END;
$function$;

-- 3. Create a simple initial population function that calls calculate_daily_schedules
CREATE OR REPLACE FUNCTION public.populate_initial_schedules()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE 'Starting initial population of schedules';
  
  -- Run the schedule calculation for the next 2 weeks
  SELECT public.calculate_daily_schedules(
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days',
    'initial_population'
  ) INTO result;
  
  RAISE NOTICE 'Initial population completed: %', result;
  
  RETURN result;
END;
$function$;