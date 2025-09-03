-- Fix scheduler sequential logic and job-level barriers
-- This migration implements proper sequential scheduling with job completion barriers

-- Drop and recreate the scheduler functions with fixed logic
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_append_jobs CASCADE;
DROP FUNCTION IF EXISTS public.place_duration_sql CASCADE;

-- Enhanced place_duration_sql with better sequential logic
CREATE OR REPLACE FUNCTION public.place_duration_sql(
  p_earliest_start timestamptz,
  p_duration_minutes integer,
  p_max_days integer DEFAULT 30
)
RETURNS TABLE(placement_success boolean, slots_created jsonb)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  current_day date;
  day_start timestamptz;
  day_end timestamptz;
  available_start timestamptz;
  remaining_minutes integer := p_duration_minutes;
  slots jsonb := '[]'::jsonb;
  day_count integer := 0;
  slot_start timestamptz;
  slot_end timestamptz;
  slot_duration integer;
  day_remaining_capacity integer;
BEGIN
  -- Validate inputs
  IF p_duration_minutes <= 0 THEN
    RETURN QUERY SELECT false, '[]'::jsonb;
    RETURN;
  END IF;

  -- Start from the earliest possible working moment
  available_start := public.next_working_start(p_earliest_start);
  current_day := available_start::date;

  WHILE remaining_minutes > 0 AND day_count < p_max_days LOOP
    day_count := day_count + 1;
    
    -- Skip non-working days
    IF NOT public.is_working_day(current_day) THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
      CONTINUE;
    END IF;

    -- Get shift window for this day
    SELECT win_start, win_end INTO day_start, day_end 
    FROM public.shift_window(current_day);
    
    IF day_start IS NULL OR day_end IS NULL THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
      CONTINUE;
    END IF;

    -- Ensure we start no earlier than shift start and no earlier than available_start
    slot_start := GREATEST(available_start, day_start);
    
    -- Calculate remaining capacity for this day
    day_remaining_capacity := GREATEST(0, EXTRACT(epoch FROM (day_end - slot_start)) / 60)::integer;
    
    -- Skip if no capacity left in this day
    IF day_remaining_capacity <= 0 THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
      CONTINUE;
    END IF;
    
    -- Calculate how much we can fit in this day
    slot_duration := LEAST(remaining_minutes, day_remaining_capacity);
    slot_end := slot_start + make_interval(mins => slot_duration);
    
    -- Add slot to our result
    slots := slots || jsonb_build_object(
      'start_time', slot_start,
      'end_time', slot_end,
      'duration_minutes', slot_duration,
      'date', current_day
    );
    
    remaining_minutes := remaining_minutes - slot_duration;
    
    -- If we still have remaining minutes, move to next day
    IF remaining_minutes > 0 THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
    END IF;
  END LOOP;

  -- Return success if we placed all minutes within the day limit
  RETURN QUERY SELECT (remaining_minutes = 0), slots;
END;
$function$;

-- Enhanced scheduler_reschedule_all with proper job-level barriers
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  
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
  PERFORM pg_advisory_xact_lock(1, 42);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting FIXED sequential scheduler from: %', base_time;

  -- Clear existing non-completed slots
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  RAISE NOTICE 'Cleared existing non-completed time slots';

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize all stages to base time
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') <> 'completed';

  RAISE NOTICE 'Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- Process jobs in STRICT FIFO order by proof_approved_at
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.proof_approved_at,
      pj.wo_no,
      COUNT(jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    WHERE COALESCE(jsi.status, '') <> 'completed'
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    -- CRITICAL FIX: Initialize job completion barrier to max of base_time and proof_approved_at
    job_completion_barrier := GREATEST(base_time, r_job.proof_approved_at);
    
    RAISE NOTICE 'Processing job % (WO: %) with % stages - job barrier starts at %', 
      r_job.job_id, r_job.wo_no, r_job.total_stages, job_completion_barrier;
    
    -- Process ALL stages for this job in STRICT stage_order sequence
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
        AND COALESCE(jsi.status, '') <> 'completed'
      ORDER BY COALESCE(jsi.stage_order, 999999) ASC, jsi.id ASC
    LOOP
      -- Get resource availability for this production stage
      SELECT next_available_time INTO resource_available_time
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id
      FOR UPDATE;

      -- CRITICAL FIX: Stage cannot start until BOTH conditions are met:
      -- 1. The production stage/queue is available
      -- 2. ALL previous stages in this job are completed (job_completion_barrier)
      stage_earliest_start := GREATEST(job_completion_barrier, resource_available_time);

      RAISE NOTICE 'Scheduling stage % (%): % mins from % (job_barrier=%, resource_avail=%)',
        r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
        stage_earliest_start, job_completion_barrier, resource_available_time;

      -- Place the duration using the corrected earliest start time
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

        -- CRITICAL FIX: Update job completion barrier
        -- This ensures the NEXT stage in this job cannot start until this stage is completed
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

  -- POST-SCHEDULING VALIDATION: Check for precedence violations
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

  RAISE NOTICE 'FIXED Scheduler complete: wrote % slots, updated % stage instances, found % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'FIXED Scheduler failed: %', SQLERRM;
END;
$function$;

-- Enhanced scheduler_append_jobs with proper job-level barriers
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[], 
  p_start_from timestamptz DEFAULT NULL, 
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer)
LANGUAGE plpgsql
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

  RAISE NOTICE 'FIXED Appending % jobs starting from %', array_length(p_job_ids, 1), base_time;

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
    -- CRITICAL FIX: Find existing job barrier from already scheduled stages
    SELECT COALESCE(MAX(scheduled_end_at), base_time)
    INTO job_completion_barrier
    FROM job_stage_instances
    WHERE job_id = r_job.job_id AND scheduled_end_at IS NOT NULL;
    
    -- Ensure barrier is not earlier than proof approval or base time
    job_completion_barrier := GREATEST(job_completion_barrier, r_job.proof_approved_at, base_time);
    
    RAISE NOTICE 'Processing job % (WO: %) - job barrier starts at %', 
      r_job.job_id, r_job.wo_no, job_completion_barrier;
    
    -- Process stages in STRICT stage_order sequence for this job
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
        AND COALESCE(jsi.status, '') <> 'completed'
        AND (NOT p_only_if_unset OR (jsi.scheduled_start_at IS NULL AND jsi.scheduled_end_at IS NULL))
      ORDER BY COALESCE(jsi.stage_order, 999999) ASC, jsi.id ASC
    LOOP
      -- Get resource availability
      SELECT next_available_time INTO resource_available_time
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id
      FOR UPDATE;

      -- CRITICAL FIX: Respect both job completion barrier AND resource availability
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

        -- CRITICAL FIX: Update job completion barrier for next stage
        job_completion_barrier := stage_end_time;

        RAISE NOTICE 'Appended stage % - ends at % (new job barrier)', 
          r_stage.stage_name, stage_end_time;
      ELSE
        RAISE WARNING 'Failed to append stage instance % (% minutes) - placement failed',
          r_stage.stage_instance_id, r_stage.duration_minutes;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'FIXED Append complete: wrote % slots, updated % stage instances', wrote_count, updated_count;

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'FIXED Append scheduler failed: %', SQLERRM;
END;
$function$;