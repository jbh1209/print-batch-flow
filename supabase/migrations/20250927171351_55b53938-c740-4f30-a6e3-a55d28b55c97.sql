-- NUCLEAR SCHEDULER REBUILD - VERSION 20241227_1445 - PROPER DROP/CREATE
-- PARALLEL PART ASSIGNMENT LOGIC FOR COVER/TEXT PROCESSING

-- DROP EXISTING FUNCTIONS TO AVOID SIGNATURE CONFLICTS
DROP FUNCTION IF EXISTS simple_scheduler_wrapper(text) CASCADE;
DROP FUNCTION IF EXISTS scheduler_append_jobs(uuid[], timestamptz, boolean) CASCADE;

-- CORE PARALLEL SCHEDULER WITH PART ASSIGNMENT LOGIC
CREATE OR REPLACE FUNCTION scheduler_reschedule_all_parallel_parts_20241227_1445()
RETURNS TABLE(
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
) LANGUAGE plpgsql AS $$
DECLARE
  stage_record RECORD;
  job_record RECORD;
  execution_time timestamptz;
  factory_start_time timestamptz;
  stage_next_available_time timestamptz;
  stage_duration_minutes integer;
  slots_written integer := 0;
  jobs_scheduled integer := 0;
BEGIN
  execution_time := now();
  
  -- Factory start time (next working day 8 AM factory time)
  factory_start_time := (execution_time::date + interval '1 day') + interval '8 hours';
  
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
      
      -- Create time slot
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
        stage_next_available_time::date,
        stage_next_available_time,
        stage_next_available_time + make_interval(mins => stage_duration_minutes),
        stage_duration_minutes,
        false
      );
      
      slots_written := slots_written + 1;
      
      -- Update job stage instance
      UPDATE job_stage_instances
      SET 
        scheduled_start_at = stage_next_available_time,
        scheduled_end_at = stage_next_available_time + make_interval(mins => stage_duration_minutes),
        scheduled_minutes = stage_duration_minutes,
        schedule_status = 'scheduled'
      WHERE id = stage_record.id;
      
      -- Update stage tail (when this stage becomes available again)
      UPDATE _stage_tails
      SET next_available_time = stage_next_available_time + make_interval(mins => stage_duration_minutes)
      WHERE stage_id = stage_record.production_stage_id;
      
      -- Update part tail (when this part becomes available for next stage)
      IF stage_record.part_assignment = 'both' THEN
        -- 'both' stages update ALL part tails
        UPDATE _part_tails
        SET next_available_time = stage_next_available_time + make_interval(mins => stage_duration_minutes)
        WHERE job_id = job_record.job_id;
      ELSE
        -- Specific part stages only update their part tail
        UPDATE _part_tails
        SET next_available_time = stage_next_available_time + make_interval(mins => stage_duration_minutes)
        WHERE job_id = job_record.job_id 
          AND part_assignment = COALESCE(stage_record.part_assignment, 'both');
      END IF;
      
    END LOOP;
    
    jobs_scheduled := jobs_scheduled + 1;
  END LOOP;
  
  -- Return results
  RETURN QUERY SELECT 
    jobs_scheduled as scheduled_count,
    slots_written as wrote_slots,
    true as success,
    'reschedule_all_parallel_parts'::text as mode,
    '20241227_1445'::text as version;
END;
$$;

-- WRAPPER FUNCTION - VERSION 20241227_1445
CREATE OR REPLACE FUNCTION simple_scheduler_wrapper_20241227_1445(p_mode text DEFAULT 'reschedule_all')
RETURNS TABLE(
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
) LANGUAGE plpgsql AS $$
BEGIN
  -- All modes route to the parallel parts scheduler
  RETURN QUERY SELECT * FROM scheduler_reschedule_all_parallel_parts_20241227_1445();
END;
$$;

-- APPEND JOBS FUNCTION - VERSION 20241227_1445
CREATE OR REPLACE FUNCTION scheduler_append_jobs_20241227_1445(
  p_job_ids uuid[] DEFAULT NULL,
  p_start_from timestamptz DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
) LANGUAGE plpgsql AS $$
DECLARE
  stage_record RECORD;
  job_record RECORD;
  execution_time timestamptz;
  factory_start_time timestamptz;
  stage_next_available_time timestamptz;
  stage_duration_minutes integer;
  slots_written integer := 0;
  jobs_scheduled integer := 0;
BEGIN
  execution_time := now();
  
  -- Use provided start time or factory start time
  factory_start_time := COALESCE(p_start_from, (execution_time::date + interval '1 day') + interval '8 hours');
  
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
  
  -- Initialize stage availability from existing slots + factory start
  INSERT INTO _stage_tails (stage_id, next_available_time)
  SELECT 
    ps.id,
    GREATEST(
      factory_start_time,
      COALESCE(MAX(sts.slot_end_time), factory_start_time)
    )
  FROM production_stages ps
  LEFT JOIN stage_time_slots sts ON ps.id = sts.production_stage_id
  WHERE ps.is_active = true
  GROUP BY ps.id;
  
  -- Process specific jobs or all jobs if none specified
  FOR job_record IN
    SELECT DISTINCT
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.qty
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
      AND (p_job_ids IS NULL OR pj.id = ANY(p_job_ids))
      AND EXISTS (
        SELECT 1 FROM job_stage_instances jsi
        WHERE jsi.job_id = pj.id 
          AND jsi.job_table_name = 'production_jobs'
          AND COALESCE(jsi.status, 'pending') = 'pending'
          AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
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
        AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
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
      
      -- Create time slot
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
        stage_next_available_time::date,
        stage_next_available_time,
        stage_next_available_time + make_interval(mins => stage_duration_minutes),
        stage_duration_minutes,
        false
      );
      
      slots_written := slots_written + 1;
      
      -- Update job stage instance
      UPDATE job_stage_instances
      SET 
        scheduled_start_at = stage_next_available_time,
        scheduled_end_at = stage_next_available_time + make_interval(mins => stage_duration_minutes),
        scheduled_minutes = stage_duration_minutes,
        schedule_status = 'scheduled'
      WHERE id = stage_record.id;
      
      -- Update stage tail (when this stage becomes available again)
      UPDATE _stage_tails
      SET next_available_time = stage_next_available_time + make_interval(mins => stage_duration_minutes)
      WHERE stage_id = stage_record.production_stage_id;
      
      -- Update part tail (when this part becomes available for next stage)
      IF stage_record.part_assignment = 'both' THEN
        -- 'both' stages update ALL part tails
        UPDATE _part_tails
        SET next_available_time = stage_next_available_time + make_interval(mins => stage_duration_minutes)
        WHERE job_id = job_record.job_id;
      ELSE
        -- Specific part stages only update their part tail
        UPDATE _part_tails
        SET next_available_time = stage_next_available_time + make_interval(mins => stage_duration_minutes)
        WHERE job_id = job_record.job_id 
          AND part_assignment = COALESCE(stage_record.part_assignment, 'both');
      END IF;
      
    END LOOP;
    
    jobs_scheduled := jobs_scheduled + 1;
  END LOOP;
  
  -- Return results
  RETURN QUERY SELECT 
    jobs_scheduled as scheduled_count,
    slots_written as wrote_slots,
    true as success,
    'append_jobs_parallel_parts'::text as mode,
    '20241227_1445'::text as version;
END;
$$;

-- RECREATE MAIN ROUTING FUNCTIONS TO USE NEW VERSIONED FUNCTIONS
CREATE OR REPLACE FUNCTION simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all')
RETURNS TABLE(
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text
) LANGUAGE plpgsql AS $$
BEGIN
  -- Route to new parallel parts scheduler
  RETURN QUERY SELECT 
    ss.scheduled_count,
    ss.wrote_slots, 
    ss.success,
    ss.mode
  FROM simple_scheduler_wrapper_20241227_1445(p_mode) ss;
END;
$$;

CREATE OR REPLACE FUNCTION scheduler_append_jobs(
  p_job_ids uuid[] DEFAULT NULL,
  p_start_from timestamptz DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(
  wrote_slots integer,
  updated_jsi integer
) LANGUAGE plpgsql AS $$
DECLARE
  result_record RECORD;
BEGIN
  -- Route to new parallel parts scheduler
  SELECT * INTO result_record
  FROM scheduler_append_jobs_20241227_1445(p_job_ids, p_start_from, p_only_if_unset)
  LIMIT 1;
  
  RETURN QUERY SELECT 
    result_record.wrote_slots as wrote_slots,
    result_record.scheduled_count as updated_jsi;
END;
$$;