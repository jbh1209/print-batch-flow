-- Enhanced spillover detection and cascade scheduling function
CREATE OR REPLACE FUNCTION public.update_production_schedules_nightly()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  spillover_jobs RECORD;
  stage_chain RECORD;
  cascade_count INTEGER := 0;
  spillover_count INTEGER := 0;
  reschedule_operations TEXT[] := '{}';
  operation_log TEXT;
BEGIN
  -- Start transaction log
  operation_log := 'Starting nightly schedule update at ' || now();
  reschedule_operations := array_append(reschedule_operations, operation_log);

  -- 1. DETECT SPILLOVER JOBS: Jobs scheduled for past dates that aren't completed
  FOR spillover_jobs IN
    SELECT DISTINCT 
      pjs.job_id,
      pjs.job_table_name,
      pjs.production_stage_id,
      pjs.scheduled_date,
      pjs.queue_position,
      jsi.status,
      jsi.stage_order,
      ps.name as stage_name,
      pj.wo_no,
      pj.customer
    FROM public.production_job_schedules pjs
    JOIN public.job_stage_instances jsi ON (
      pjs.job_id = jsi.job_id 
      AND pjs.production_stage_id = jsi.production_stage_id
      AND pjs.job_table_name = jsi.job_table_name
    )
    JOIN public.production_stages ps ON pjs.production_stage_id = ps.id
    JOIN public.production_jobs pj ON pjs.job_id = pj.id
    WHERE pjs.scheduled_date < CURRENT_DATE
      AND jsi.status IN ('active', 'pending')
      AND pjs.job_table_name = 'production_jobs'
    ORDER BY pjs.scheduled_date ASC, pjs.queue_position ASC
  LOOP
    spillover_count := spillover_count + 1;
    operation_log := format('SPILLOVER DETECTED: Job %s (%s) - Stage: %s - Original date: %s - Status: %s', 
      spillover_jobs.wo_no, spillover_jobs.customer, spillover_jobs.stage_name, 
      spillover_jobs.scheduled_date, spillover_jobs.status);
    reschedule_operations := array_append(reschedule_operations, operation_log);

    -- 2. FIND ALL SUBSEQUENT STAGES FOR THIS JOB (cascade chain)
    FOR stage_chain IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.production_stage_id,
        jsi.stage_order,
        ps.name as stage_name,
        COALESCE(pjs.scheduled_date, CURRENT_DATE) as current_scheduled_date,
        COALESCE(pjs.queue_position, 999) as current_queue_position
      FROM public.job_stage_instances jsi
      JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
      LEFT JOIN public.production_job_schedules pjs ON (
        jsi.job_id = pjs.job_id 
        AND jsi.production_stage_id = pjs.production_stage_id
        AND jsi.job_table_name = pjs.job_table_name
      )
      WHERE jsi.job_id = spillover_jobs.job_id
        AND jsi.job_table_name = spillover_jobs.job_table_name
        AND jsi.stage_order >= spillover_jobs.stage_order
        AND jsi.status IN ('pending', 'active')
      ORDER BY jsi.stage_order ASC
    LOOP
      cascade_count := cascade_count + 1;
      
      -- 3. CALCULATE NEW SCHEDULE DATE (next working day for first spillover stage)
      DECLARE
        new_schedule_date DATE;
        days_to_add INTEGER := 0;
      BEGIN
        -- Start from today and find next working day
        new_schedule_date := CURRENT_DATE;
        
        -- Skip weekends (assumes Monday=1, Sunday=7)
        WHILE EXTRACT(DOW FROM new_schedule_date) IN (0, 6) OR 
              public.is_public_holiday(new_schedule_date) 
        LOOP
          new_schedule_date := new_schedule_date + INTERVAL '1 day';
          days_to_add := days_to_add + 1;
        END LOOP;

        -- For subsequent stages in the chain, add buffer days based on stage order difference
        IF stage_chain.stage_order > spillover_jobs.stage_order THEN
          -- Add 1 day buffer for each subsequent stage to allow for processing time
          new_schedule_date := new_schedule_date + ((stage_chain.stage_order - spillover_jobs.stage_order) * INTERVAL '1 day');
          
          -- Skip weekends again after adding buffer
          WHILE EXTRACT(DOW FROM new_schedule_date) IN (0, 6) OR 
                public.is_public_holiday(new_schedule_date) 
          LOOP
            new_schedule_date := new_schedule_date + INTERVAL '1 day';
          END LOOP;
        END IF;

        -- 4. PUSH DOWN EXISTING JOBS ON THE TARGET DATE
        -- First, increment queue positions for all jobs scheduled for this date/stage
        UPDATE public.production_job_schedules
        SET 
          queue_position = queue_position + 1,
          updated_at = now()
        WHERE scheduled_date = new_schedule_date
          AND production_stage_id = stage_chain.production_stage_id
          AND job_id != spillover_jobs.job_id; -- Don't push down the spillover job itself

        -- 5. RESCHEDULE THE SPILLOVER STAGE TO POSITION 1 (TOP PRIORITY)
        INSERT INTO public.production_job_schedules (
          job_id,
          job_table_name,
          production_stage_id,
          scheduled_date,
          queue_position,
          shift_number,
          estimated_duration_minutes,
          created_by,
          version
        ) VALUES (
          spillover_jobs.job_id,
          spillover_jobs.job_table_name,
          stage_chain.production_stage_id,
          new_schedule_date,
          1, -- TOP PRIORITY for spillover jobs
          1, -- Default shift
          120, -- Default 2 hours, TODO: get from stage capacity
          NULL, -- System generated
          1
        )
        ON CONFLICT (job_id, production_stage_id) 
        DO UPDATE SET
          scheduled_date = EXCLUDED.scheduled_date,
          queue_position = EXCLUDED.queue_position,
          updated_at = now();

        operation_log := format('RESCHEDULED: Stage %s (%s) to %s at position 1 (pushed %s existing jobs down)', 
          stage_chain.stage_name, spillover_jobs.wo_no, new_schedule_date, 
          (SELECT COUNT(*) FROM public.production_job_schedules 
           WHERE scheduled_date = new_schedule_date 
           AND production_stage_id = stage_chain.production_stage_id 
           AND queue_position > 1));
        reschedule_operations := array_append(reschedule_operations, operation_log);
      END;
    END LOOP;

    -- 6. REMOVE OLD SCHEDULE ENTRIES for this job (cleanup past dates)
    DELETE FROM public.production_job_schedules
    WHERE job_id = spillover_jobs.job_id
      AND job_table_name = spillover_jobs.job_table_name
      AND scheduled_date < CURRENT_DATE;

    operation_log := format('CLEANED UP: Removed past schedule entries for job %s', spillover_jobs.wo_no);
    reschedule_operations := array_append(reschedule_operations, operation_log);
  END LOOP;

  -- 7. REORDER QUEUE POSITIONS for consistency (remove gaps)
  WITH ordered_jobs AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY production_stage_id, scheduled_date, shift_number 
        ORDER BY queue_position ASC, updated_at ASC
      ) as new_position
    FROM public.production_job_schedules
    WHERE scheduled_date >= CURRENT_DATE
  )
  UPDATE public.production_job_schedules pjs
  SET 
    queue_position = oj.new_position,
    updated_at = now()
  FROM ordered_jobs oj
  WHERE pjs.id = oj.id
    AND pjs.queue_position != oj.new_position;

  operation_log := format('REORDERED: Cleaned up queue positions for all future schedules');
  reschedule_operations := array_append(reschedule_operations, operation_log);

  -- Final summary
  operation_log := format('COMPLETED: Processed %s spillover jobs, %s total stage reschedules at %s', 
    spillover_count, cascade_count, now());
  reschedule_operations := array_append(reschedule_operations, operation_log);

  -- Return detailed operation log
  RETURN jsonb_build_object(
    'success', true,
    'spillover_jobs_processed', spillover_count,
    'total_stage_reschedules', cascade_count,
    'completed_at', now(),
    'operations_log', reschedule_operations
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure status
    operation_log := format('ERROR: %s at %s', SQLERRM, now());
    reschedule_operations := array_append(reschedule_operations, operation_log);
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'spillover_jobs_processed', spillover_count,
      'total_stage_reschedules', cascade_count,
      'failed_at', now(),
      'operations_log', reschedule_operations
    );
END;
$$;