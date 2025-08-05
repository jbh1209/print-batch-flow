-- Phase 2: Build Scheduling Engine as Database Functions

-- Function to calculate daily schedules for all stages
CREATE OR REPLACE FUNCTION public.calculate_daily_schedules(
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT CURRENT_DATE + INTERVAL '14 days',
  p_calculation_type text DEFAULT 'nightly_full'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
BEGIN
  -- Log calculation start
  INSERT INTO public.schedule_calculation_log (
    calculation_run_id, calculation_type, trigger_reason, started_at, created_by
  ) VALUES (
    calc_run_id, p_calculation_type, 'Automated daily schedule calculation', start_time, auth.uid()
  );

  -- Clear existing future schedules (keep current day and past)
  DELETE FROM public.job_schedule_assignments 
  WHERE scheduled_date > CURRENT_DATE AND calculation_run_id IS NULL;

  -- Process each date in the range
  processing_date := p_start_date;
  WHILE processing_date <= p_end_date LOOP
    -- Skip weekends and holidays
    IF EXTRACT(DOW FROM processing_date) NOT IN (0, 6) 
       AND NOT EXISTS (SELECT 1 FROM public.public_holidays WHERE date = processing_date AND is_active = true) THEN
      
      -- Process each active production stage
      FOR stage_record IN
        SELECT ps.id, ps.name, 
               COALESCE(scp.daily_capacity_hours * 60, 480) as capacity_minutes
        FROM public.production_stages ps
        LEFT JOIN public.stage_capacity_profiles scp ON ps.id = scp.production_stage_id
        WHERE ps.is_active = true
        ORDER BY ps.order_index
      LOOP
        stages_affected := stages_affected + 1;
        daily_capacity_minutes := stage_record.capacity_minutes;
        current_allocation := 0;
        queue_position := 1;

        -- Ensure daily schedule record exists
        INSERT INTO public.daily_production_schedule (
          date, production_stage_id, total_capacity_minutes, allocated_minutes, shift_number
        ) VALUES (
          processing_date, stage_record.id, daily_capacity_minutes, 0, 1
        ) ON CONFLICT (date, production_stage_id, shift_number) 
        DO UPDATE SET 
          total_capacity_minutes = EXCLUDED.total_capacity_minutes,
          updated_at = now();

        -- Schedule jobs for this stage on this date
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
          ELSE
            -- Capacity full, move to next date
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

  RETURN jsonb_build_object(
    'success', true,
    'calculation_run_id', calc_run_id,
    'jobs_processed', jobs_processed,
    'stages_affected', stages_affected,
    'date_range', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    )
  );
END;
$$;

-- Function to reschedule a specific job
CREATE OR REPLACE FUNCTION public.reschedule_job_server_side(
  p_job_id uuid,
  p_job_table_name text,
  p_production_stage_id uuid,
  p_new_date date,
  p_new_queue_position integer DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calc_run_id uuid := gen_random_uuid();
  old_assignment RECORD;
  new_position integer;
  duration_minutes integer;
BEGIN
  -- Log the reschedule operation
  INSERT INTO public.schedule_calculation_log (
    calculation_run_id, calculation_type, trigger_reason, created_by
  ) VALUES (
    calc_run_id, 'manual_reschedule', p_reason, auth.uid()
  );

  -- Get existing assignment
  SELECT * INTO old_assignment
  FROM public.job_schedule_assignments
  WHERE job_id = p_job_id 
    AND production_stage_id = p_production_stage_id
    AND status = 'scheduled';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job assignment not found for rescheduling';
  END IF;

  duration_minutes := old_assignment.estimated_duration_minutes;

  -- Determine new queue position
  IF p_new_queue_position IS NULL THEN
    SELECT COALESCE(MAX(queue_position), 0) + 1 INTO new_position
    FROM public.job_schedule_assignments
    WHERE scheduled_date = p_new_date 
      AND production_stage_id = p_production_stage_id
      AND status = 'scheduled';
  ELSE
    new_position := p_new_queue_position;
    
    -- Push down other jobs in the queue
    UPDATE public.job_schedule_assignments
    SET queue_position = queue_position + 1,
        updated_at = now()
    WHERE scheduled_date = p_new_date 
      AND production_stage_id = p_production_stage_id
      AND queue_position >= new_position
      AND job_id != p_job_id;
  END IF;

  -- Update the job assignment
  UPDATE public.job_schedule_assignments
  SET scheduled_date = p_new_date,
      queue_position = new_position,
      status = 'scheduled',
      calculation_run_id = calc_run_id,
      updated_at = now()
  WHERE job_id = p_job_id 
    AND production_stage_id = p_production_stage_id;

  -- Update daily schedule allocations
  -- Remove from old date
  UPDATE public.daily_production_schedule
  SET allocated_minutes = allocated_minutes - duration_minutes,
      updated_at = now()
  WHERE date = old_assignment.scheduled_date 
    AND production_stage_id = p_production_stage_id;

  -- Add to new date (create record if doesn't exist)
  INSERT INTO public.daily_production_schedule (
    date, production_stage_id, allocated_minutes, shift_number
  ) VALUES (
    p_new_date, p_production_stage_id, duration_minutes, 1
  ) ON CONFLICT (date, production_stage_id, shift_number)
  DO UPDATE SET 
    allocated_minutes = daily_production_schedule.allocated_minutes + duration_minutes,
    updated_at = now();

  -- Complete the log
  UPDATE public.schedule_calculation_log
  SET completed_at = now(),
      jobs_processed = 1,
      stages_affected = 1
  WHERE calculation_run_id = calc_run_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'old_date', old_assignment.scheduled_date,
    'new_date', p_new_date,
    'new_position', new_position
  );
END;
$$;