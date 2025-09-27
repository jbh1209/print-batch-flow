-- FIX SCHEDULER LUNCH BREAK HANDLING - VERSION 20241227_1445
-- Replace direct time arithmetic with proper place_duration_sql calls

-- Update wrapper function to accept start_from parameter
CREATE OR REPLACE FUNCTION simple_scheduler_wrapper_20241227_1445(
  p_mode text DEFAULT 'reschedule_all',
  p_start_from timestamptz DEFAULT NULL
)
RETURNS TABLE(
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- All modes route to the parallel parts scheduler with start_from parameter
  RETURN QUERY SELECT * FROM scheduler_reschedule_all_parallel_parts_20241227_1445(p_start_from);
END;
$$;

-- Update main parallel scheduler to use place_duration_sql for proper lunch break handling
CREATE OR REPLACE FUNCTION scheduler_reschedule_all_parallel_parts_20241227_1445(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS TABLE(
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  stage_record RECORD;
  job_record RECORD;
  execution_time timestamptz;
  factory_start_time timestamptz;
  stage_next_available_time timestamptz;
  stage_duration_minutes integer;
  slots_written integer := 0;
  jobs_scheduled integer := 0;
  time_slots_result jsonb;
  slot_data jsonb;
BEGIN
  execution_time := now();
  
  -- Use provided start time or factory start time (properly aligned to working hours)
  IF p_start_from IS NOT NULL THEN
    factory_start_time := next_working_start(p_start_from);
  ELSE
    factory_start_time := next_working_start((execution_time::date + interval '1 day') + interval '8 hours');
  END IF;
  
  -- Clear existing non-completed scheduling data
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = 'unscheduled'
  WHERE COALESCE(status, '') NOT IN ('completed', 'active')
    AND (scheduled_start_at IS NOT NULL OR scheduled_end_at IS NOT NULL);
  
  -- Create temporary table for tracking part availability
  DROP TABLE IF EXISTS _part_tails;
  CREATE TEMP TABLE _part_tails (
    job_id uuid,
    part_assignment text,
    next_available_time timestamptz,
    PRIMARY KEY (job_id, part_assignment)
  );
  
  -- Create temporary table for tracking stage availability
  DROP TABLE IF EXISTS _stage_tails;
  CREATE TEMP TABLE _stage_tails (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
  
  -- Initialize stage availability
  INSERT INTO _stage_tails (stage_id, next_available_time)
  SELECT ps.id, factory_start_time
  FROM production_stages ps
  WHERE ps.is_active = true;
  
  -- Process jobs in FIFO order by proof_approved_at
  FOR job_record IN
    SELECT DISTINCT
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.qty
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM job_stage_instances jsi
        WHERE jsi.job_id = pj.id 
          AND jsi.job_table_name = 'production_jobs'
          AND COALESCE(jsi.status, 'pending') = 'pending'
      )
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    -- Initialize part tails for this job
    INSERT INTO _part_tails (job_id, part_assignment, next_available_time)
    VALUES 
      (job_record.job_id, 'cover', factory_start_time),
      (job_record.job_id, 'text', factory_start_time),
      (job_record.job_id, 'both', factory_start_time)
    ON CONFLICT (job_id, part_assignment) DO UPDATE SET
      next_available_time = factory_start_time;
    
    -- Process stages for this job in stage_order
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.stage_order,
        jsi.part_assignment,
        ps.name as stage_name,
        COALESCE(jsi.estimated_duration_minutes, 60) as duration_minutes
      FROM job_stage_instances jsi
      JOIN production_stages ps ON jsi.production_stage_id = ps.id
      WHERE jsi.job_id = job_record.job_id
        AND jsi.job_table_name = 'production_jobs'
        AND COALESCE(jsi.status, 'pending') = 'pending'
      ORDER BY jsi.stage_order ASC
    LOOP
      -- Determine stage start time based on part assignment logic
      IF stage_record.part_assignment = 'both' THEN
        -- 'both' stages wait for ALL parts (cover AND text) to complete
        SELECT GREATEST(
          COALESCE((SELECT next_available_time FROM _part_tails WHERE job_id = job_record.job_id AND part_assignment = 'cover'), factory_start_time),
          COALESCE((SELECT next_available_time FROM _part_tails WHERE job_id = job_record.job_id AND part_assignment = 'text'), factory_start_time),
          COALESCE((SELECT next_available_time FROM _stage_tails WHERE stage_id = stage_record.production_stage_id), factory_start_time)
        ) INTO stage_next_available_time;
      ELSE
        -- Cover or text stages use their specific part tail + stage availability
        SELECT GREATEST(
          COALESCE((SELECT next_available_time FROM _part_tails WHERE job_id = job_record.job_id AND part_assignment = COALESCE(stage_record.part_assignment, 'both')), factory_start_time),
          COALESCE((SELECT next_available_time FROM _stage_tails WHERE stage_id = stage_record.production_stage_id), factory_start_time)
        ) INTO stage_next_available_time;
      END IF;
      
      stage_duration_minutes := stage_record.duration_minutes;
      
      -- CRITICAL FIX: Use place_duration_sql to handle lunch breaks and shift boundaries
      SELECT place_duration_sql(stage_next_available_time, stage_duration_minutes) INTO time_slots_result;
      
      -- Insert time slots using proper lunch break handling
      FOR slot_data IN SELECT * FROM jsonb_array_elements(time_slots_result)
      LOOP
        INSERT INTO stage_time_slots (
          production_stage_id,
          job_id,
          stage_instance_id,
          job_table_name,
          date,
          slot_start_time,
          slot_end_time,
          duration_minutes,
          is_completed
        ) VALUES (
          stage_record.production_stage_id,
          job_record.job_id,
          stage_record.id,
          'production_jobs',
          (slot_data->>'date')::date,
          (slot_data->>'start_time')::timestamptz,
          (slot_data->>'end_time')::timestamptz,
          (slot_data->>'duration_minutes')::integer,
          false
        );
        
        slots_written := slots_written + 1;
      END LOOP;
      
      -- Calculate total end time from all slots
      DECLARE
        slot_start_time timestamptz;
        slot_end_time timestamptz;
      BEGIN
        SELECT 
          MIN((s->>'start_time')::timestamptz),
          MAX((s->>'end_time')::timestamptz)
        INTO slot_start_time, slot_end_time
        FROM jsonb_array_elements(time_slots_result) s;
        
        -- Update job stage instance with calculated times
        UPDATE job_stage_instances
        SET 
          scheduled_start_at = slot_start_time,
          scheduled_end_at = slot_end_time,
          scheduled_minutes = stage_duration_minutes,
          schedule_status = 'scheduled'
        WHERE id = stage_record.id;
        
        -- Update stage tail (when this stage becomes available again)
        UPDATE _stage_tails
        SET next_available_time = slot_end_time
        WHERE stage_id = stage_record.production_stage_id;
        
        -- Update part tail (when this part becomes available for next stage)
        IF stage_record.part_assignment = 'both' THEN
          -- 'both' stages update ALL part tails
          UPDATE _part_tails
          SET next_available_time = slot_end_time
          WHERE job_id = job_record.job_id;
        ELSE
          -- Specific part stages only update their part tail
          UPDATE _part_tails
          SET next_available_time = slot_end_time
          WHERE job_id = job_record.job_id 
            AND part_assignment = COALESCE(stage_record.part_assignment, 'both');
        END IF;
        
        -- Log scheduling decision
        INSERT INTO scheduling_decision_logs (
          job_id,
          stage_id,
          job_table_name,
          decision_type,
          requested_start_time,
          assigned_start_time,
          assigned_end_time,
          duration_minutes,
          decision_reasoning,
          scheduler_version
        ) VALUES (
          job_record.job_id,
          stage_record.production_stage_id,
          'production_jobs',
          'schedule_with_lunch_handling',
          stage_next_available_time,
          slot_start_time,
          slot_end_time,
          stage_duration_minutes,
          format('Scheduled %s with part assignment %s using place_duration_sql', stage_record.stage_name, COALESCE(stage_record.part_assignment, 'none')),
          '20241227_1445'
        );
      END;
    END LOOP;
    
    jobs_scheduled := jobs_scheduled + 1;
  END LOOP;
  
  -- Return results
  RETURN QUERY SELECT 
    jobs_scheduled as scheduled_count,
    slots_written as wrote_slots,
    true as success,
    'reschedule_all_parallel_parts_lunch_aware'::text as mode,
    '20241227_1445'::text as version;
END;
$$;