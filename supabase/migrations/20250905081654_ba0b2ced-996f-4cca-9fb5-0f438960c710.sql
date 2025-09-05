-- Phase 1: Remove the problematic calculate_job_completion_barrier function entirely
DROP FUNCTION IF EXISTS public.calculate_job_completion_barrier(uuid, integer, text);

-- Phase 2: Update scheduler_append_jobs to ignore completed stages and use simple sequential logic
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(p_job_ids uuid[], p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_only_if_unset boolean DEFAULT true)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  base_time timestamptz := public.next_working_start(COALESCE(p_start_from, now() AT TIME ZONE 'utc'));
  wrote_count integer := 0;
  updated_count integer := 0;
  
  -- Job processing variables
  r_job record;
  r_stage record;
  
  -- Scheduling variables
  resource_available_time timestamptz;
  job_completion_barrier timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
BEGIN
  -- Validation
  IF p_job_ids IS NULL OR array_length(p_job_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'scheduler_append_jobs: p_job_ids must not be empty';
  END IF;

  -- Advisory lock
  PERFORM pg_advisory_xact_lock(1, 42);

  RAISE NOTICE 'ENHANCED Appending % jobs starting from %', array_length(p_job_ids, 1), base_time;

  -- Initialize stage availability tracker from existing slots
  PERFORM public.create_stage_availability_tracker();
  
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    GREATEST(MAX(slot_end_time), base_time)
  FROM stage_time_slots
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- Ensure all relevant stages have entries
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE jsi.job_id = ANY(p_job_ids)
  ON CONFLICT (stage_id) DO NOTHING;

  -- Process jobs in FIFO order by proof_approved_at (same as reschedule_all)
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.proof_approved_at,
      pj.wo_no
    FROM production_jobs pj
    WHERE pj.id = ANY(p_job_ids)
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    -- SIMPLE LOGIC: Start from base_time or proof approval, whichever is later
    job_completion_barrier := GREATEST(base_time, COALESCE(r_job.proof_approved_at, base_time));
    
    RAISE NOTICE 'Appending job % (WO: %) - starting from %', 
      r_job.job_id, r_job.wo_no, job_completion_barrier;
    
    -- Process ONLY non-completed stages in STRICT stage_order sequence
    FOR r_stage IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.production_stage_id,
        jsi.stage_order,
        public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') NOT IN ('completed')  -- IGNORE completed stages
        AND (NOT p_only_if_unset OR (jsi.scheduled_start_at IS NULL AND jsi.scheduled_end_at IS NULL))
      ORDER BY COALESCE(jsi.stage_order, 999999) ASC, jsi.id ASC
    LOOP
      -- Get resource availability
      SELECT next_available_time INTO resource_available_time
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id
      FOR UPDATE;

      -- Simple logic: Wait for both job barrier AND resource availability
      stage_earliest_start := GREATEST(job_completion_barrier, resource_available_time);

      RAISE NOTICE 'Appending stage % (%): % mins from % (job_barrier=%, resource_avail=%)',
        r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
        stage_earliest_start, job_completion_barrier, resource_available_time;

      -- Place the duration
      SELECT * INTO placement_result
      FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
      
      IF placement_result.placement_success AND placement_result.slots_created IS NOT NULL THEN
        -- Create time slots
        FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
        LOOP
          INSERT INTO stage_time_slots(
            production_stage_id,
            date,
            slot_start_time,
            slot_end_time,
            duration_minutes,
            job_id,
            job_table_name,
            stage_instance_id,
            is_completed
          )
          VALUES (
            r_stage.production_stage_id,
            (slot_record ->> 'date')::date,
            (slot_record ->> 'start_time')::timestamptz,
            (slot_record ->> 'end_time')::timestamptz,
            (slot_record ->> 'duration_minutes')::integer,
            r_job.job_id,
            'production_jobs',
            r_stage.stage_instance_id,
            false
          );
          wrote_count := wrote_count + 1;
        END LOOP;

        -- Calculate stage end time
        SELECT MAX((time_slot ->> 'end_time')::timestamptz)
        INTO stage_end_time
        FROM jsonb_array_elements(placement_result.slots_created) time_slot;

        -- Update resource availability
        UPDATE _stage_tails 
        SET next_available_time = stage_end_time
        WHERE stage_id = r_stage.production_stage_id;

        -- Update job stage instance
        UPDATE job_stage_instances
        SET 
          scheduled_minutes = r_stage.duration_minutes,
          scheduled_start_at = (
            SELECT MIN((time_slot ->> 'start_time')::timestamptz)
            FROM jsonb_array_elements(placement_result.slots_created) time_slot
          ),
          scheduled_end_at = stage_end_time,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = r_stage.stage_instance_id;
        updated_count := updated_count + 1;

        -- Update job barrier for next stage in this job
        job_completion_barrier := stage_end_time;

        RAISE NOTICE 'Appended stage % - ends at % (new job barrier)', 
          r_stage.stage_name, stage_end_time;
      ELSE
        RAISE WARNING 'Failed to append stage instance % (% minutes) - placement failed',
          r_stage.stage_instance_id, r_stage.duration_minutes;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'ENHANCED Append complete: wrote % slots, updated % stage instances', wrote_count, updated_count;

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'ENHANCED Append scheduler failed: %', SQLERRM;
END;
$function$;

-- Phase 3: Remove legacy scheduler functions that are no longer needed
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all(timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_barrier_fixed(timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_persistent_queues(timestamp with time zone);

-- Phase 4: Create a simple clearing function for non-completed stages only
CREATE OR REPLACE FUNCTION public.clear_non_completed_scheduling_data()
 RETURNS TABLE(cleared_slots integer, cleared_instances integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  slots_count integer := 0;
  instances_count integer := 0;
BEGIN
  -- Clear non-completed time slots only
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  GET DIAGNOSTICS slots_count = ROW_COUNT;
  
  -- Clear scheduling data from non-completed job stage instances only
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE COALESCE(status, '') NOT IN ('completed');
  GET DIAGNOSTICS instances_count = ROW_COUNT;
  
  RAISE NOTICE 'Cleared % non-completed slots and % non-completed instances', slots_count, instances_count;
  
  cleared_slots := slots_count;
  cleared_instances := instances_count;
  RETURN NEXT;
END;
$function$;

-- Update the main sequential enhanced scheduler to use the new clearing function
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_sequential_enhanced(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  clear_result record;
  
  -- Job processing variables
  r_job record;
  r_stage record;
  
  -- Scheduling variables
  resource_available_time timestamptz;
  job_completion_barrier timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 45);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting ENHANCED sequential scheduler from: %', base_time;

  -- Use the new clearing function
  SELECT * INTO clear_result FROM public.clear_non_completed_scheduling_data();
  RAISE NOTICE 'Cleared % slots and % instances', clear_result.cleared_slots, clear_result.cleared_instances;

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize all stages to base time, accounting for existing completed work
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    GREATEST(
      COALESCE(MAX(slot_end_time), base_time), 
      base_time
    )
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- Initialize any stages without completed work
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') NOT IN ('completed')
  ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE 'Initialized % production stages for enhanced scheduling', (SELECT COUNT(*) FROM _stage_tails);

  -- Process jobs in STRICT FIFO order by proof_approved_at, IGNORING completed stages
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.proof_approved_at,
      pj.wo_no,
      COUNT(jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    WHERE COALESCE(jsi.status, '') NOT IN ('completed')  -- IGNORE completed stages
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    -- Simple logic: Start each job from base_time or proof approval
    job_completion_barrier := GREATEST(base_time, COALESCE(r_job.proof_approved_at, base_time));
    
    RAISE NOTICE 'Processing job % (WO: %) with % non-completed stages - starting from %', 
      r_job.job_id, r_job.wo_no, r_job.total_stages, job_completion_barrier;
    
    -- Process ONLY non-completed stages in STRICT stage_order sequence
    FOR r_stage IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.production_stage_id,
        jsi.stage_order,
        public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') NOT IN ('completed')  -- CRITICAL: Ignore completed stages
      ORDER BY COALESCE(jsi.stage_order, 999999) ASC, jsi.id ASC
    LOOP
      -- Get resource availability for this production stage
      SELECT next_available_time INTO resource_available_time
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id
      FOR UPDATE;

      -- Simple logic: Stage waits for BOTH job barrier AND resource availability
      stage_earliest_start := GREATEST(job_completion_barrier, resource_available_time);

      RAISE NOTICE 'Scheduling stage % (%): % mins from % (job_barrier=%, resource_avail=%)',
        r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
        stage_earliest_start, job_completion_barrier, resource_available_time;

      -- Place the duration using the enhanced placement logic
      SELECT * INTO placement_result
      FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
      
      IF placement_result.placement_success AND placement_result.slots_created IS NOT NULL THEN
        -- Validate slots_created is not empty
        IF jsonb_array_length(placement_result.slots_created) = 0 THEN
          RAISE WARNING 'No slots created for stage % (% minutes)', 
            r_stage.stage_instance_id, r_stage.duration_minutes;
          CONTINUE;
        END IF;

        -- Create time slots from placement result
        FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
        LOOP
          INSERT INTO stage_time_slots(
            production_stage_id,
            date,
            slot_start_time,
            slot_end_time,
            duration_minutes,
            job_id,
            job_table_name,
            stage_instance_id,
            is_completed
          )
          VALUES (
            r_stage.production_stage_id,
            (slot_record ->> 'date')::date,
            (slot_record ->> 'start_time')::timestamptz,
            (slot_record ->> 'end_time')::timestamptz,
            (slot_record ->> 'duration_minutes')::integer,
            r_job.job_id,
            'production_jobs',
            r_stage.stage_instance_id,
            false
          );
          wrote_count := wrote_count + 1;
        END LOOP;

        -- Calculate stage end time
        SELECT MAX((time_slot ->> 'end_time')::timestamptz)
        INTO stage_end_time
        FROM jsonb_array_elements(placement_result.slots_created) time_slot;

        -- Update resource availability for this production stage
        UPDATE _stage_tails 
        SET next_available_time = stage_end_time
        WHERE stage_id = r_stage.production_stage_id;

        -- Update job stage instance
        UPDATE job_stage_instances
        SET 
          scheduled_minutes = r_stage.duration_minutes,
          scheduled_start_at = (
            SELECT MIN((time_slot ->> 'start_time')::timestamptz)
            FROM jsonb_array_elements(placement_result.slots_created) time_slot
          ),
          scheduled_end_at = stage_end_time,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = r_stage.stage_instance_id;
        updated_count := updated_count + 1;

        -- Update job completion barrier for next stage in this job
        job_completion_barrier := stage_end_time;

        RAISE NOTICE 'Completed scheduling stage % - ends at % (new job barrier)', 
          r_stage.stage_name, stage_end_time;
      ELSE
        RAISE WARNING 'Failed to schedule stage instance % (% minutes) - placement failed',
          r_stage.stage_instance_id, r_stage.duration_minutes;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed job % - final barrier at %', r_job.job_id, job_completion_barrier;
  END LOOP;

  -- Validation: Check for precedence violations
  SELECT jsonb_agg(
    jsonb_build_object(
      'job_id', v.job_id,
      'violation_type', v.violation_type,
      'stage1_name', v.stage1_name,
      'stage1_order', v.stage1_order,
      'stage2_name', v.stage2_name,
      'stage2_order', v.stage2_order,
      'violation_details', v.violation_details
    )
  ) INTO validation_results
  FROM public.validate_job_scheduling_precedence() v;

  IF validation_results IS NULL THEN
    validation_results := '[]'::jsonb;
  END IF;

  RAISE NOTICE 'ENHANCED Scheduler complete: wrote % slots, updated % stage instances, found % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'ENHANCED Scheduler failed: %', SQLERRM;
END;
$function$;