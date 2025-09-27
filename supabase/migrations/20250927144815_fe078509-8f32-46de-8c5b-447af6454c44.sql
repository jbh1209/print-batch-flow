-- RESTORE SEPTEMBER 24TH VERSION 1.0 SCHEDULER - WORKING CONFIGURATION
-- This migration restores the exact working scheduler state from September 24th VERSION 1.0 milestone

-- 1. Restore the original scheduler_reschedule_all_sequential_fixed function (from 20250905091655)
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_sequential_fixed(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  clear_result record;
  
  -- Job processing variables
  r_job record;
  r_stage record;
  
  -- CRITICAL: Job-level barriers for sequential processing
  job_barriers JSONB := '{}'::jsonb;
  
  -- Scheduling variables
  resource_available_time timestamptz;
  job_current_barrier timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 50);

  -- Determine base scheduling time
  base_time := COALESCE(public.next_working_start(p_start_from), public.next_working_start(now()));

  RAISE NOTICE 'FIXED Sequential Scheduler: Starting from %', base_time;

  -- Clear ALL non-completed scheduling data to start fresh
  SELECT * INTO clear_result FROM public.clear_non_completed_scheduling_data();
  RAISE NOTICE 'FIXED Scheduler: Cleared % slots and % instances', clear_result.cleared_slots, clear_result.cleared_instances;

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize all stages to base time, but preserve completed work
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

  -- Initialize stages without completed slots
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
  ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE 'FIXED Scheduler: Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- CRITICAL FIX: Process jobs in FIFO order and maintain per-job barriers
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.proof_approved_at,
      pj.wo_no,
      COUNT(jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    -- INITIALIZE job barrier for THIS SPECIFIC JOB
    job_current_barrier := GREATEST(base_time, COALESCE(r_job.proof_approved_at, base_time));
    
    -- Store this job's barrier
    job_barriers := jsonb_set(job_barriers, ARRAY[r_job.job_id::text], to_jsonb(job_current_barrier));
    
    RAISE NOTICE 'FIXED: Starting job % (WO: %) - INITIAL barrier: %', 
      r_job.job_id, r_job.wo_no, job_current_barrier;
    
    -- Process stages for THIS JOB in STRICT sequential order
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
        AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      ORDER BY COALESCE(jsi.stage_order, 999999) ASC, jsi.id ASC
    LOOP
      -- Get current job barrier for this job
      job_current_barrier := (job_barriers ->> r_job.job_id::text)::timestamptz;
      
      -- Get resource availability
      SELECT next_available_time INTO resource_available_time
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id
      FOR UPDATE;

      -- CRITICAL: Stage MUST wait for BOTH job completion AND resource availability
      stage_earliest_start := GREATEST(job_current_barrier, resource_available_time);

      RAISE NOTICE 'FIXED: Scheduling %: order=%, duration=%min, earliest_start=%, job_barrier=%, resource_avail=%',
        r_stage.stage_name, r_stage.stage_order, r_stage.duration_minutes, 
        stage_earliest_start, job_current_barrier, resource_available_time;

      -- Place the duration using enhanced placement
      SELECT * INTO placement_result
      FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
      
      IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
        RAISE EXCEPTION 'CRITICAL FAILURE: Cannot schedule stage % for job % at %',
          r_stage.stage_name, r_job.job_id, stage_earliest_start;
      END IF;

      -- Create time slots from placement
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

      -- Calculate when this stage actually ends
      SELECT MAX((time_slot ->> 'end_time')::timestamptz)
      INTO stage_end_time
      FROM jsonb_array_elements(placement_result.slots_created) time_slot;

      -- CRITICAL FIX: Update resource availability immediately
      UPDATE _stage_tails 
      SET next_available_time = stage_end_time
      WHERE stage_id = r_stage.production_stage_id;

      -- Update job stage instance with calculated times
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

      -- ABSOLUTE CRITICAL FIX: Update job barrier for THIS JOB to ensure next stage waits
      job_barriers := jsonb_set(job_barriers, ARRAY[r_job.job_id::text], to_jsonb(stage_end_time));

      RAISE NOTICE 'FIXED: Completed stage % - ends at % - UPDATED job barrier to %',
        r_stage.stage_name, stage_end_time, stage_end_time;
    END LOOP;
    
    RAISE NOTICE 'FIXED: Completed job % - final barrier: %', 
      r_job.job_id, (job_barriers ->> r_job.job_id::text);
  END LOOP;

  -- Final validation
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

  RAISE NOTICE 'FIXED Sequential Scheduler COMPLETE: % slots written, % instances updated, % violations remain', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'FIXED Sequential Scheduler failed: %', SQLERRM;
END;
$$;

-- 2. Restore the critical routing fix from September 24th (from 20250924111832)
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_record RECORD;
  result_json jsonb;
BEGIN
  RAISE NOTICE 'Scheduler wrapper called with mode: %', p_mode;
  
  -- Route reschedule_all to the ORIGINAL SEQUENTIAL scheduler (Monday morning behavior)
  IF p_mode = 'reschedule_all' THEN
    RAISE NOTICE 'Using ORIGINAL SEQUENTIAL scheduler for reschedule_all (Monday morning behavior)';
    
    SELECT * INTO result_record 
    FROM public.scheduler_reschedule_all_sequential_fixed(NULL);
    
    -- Normalize the response to match expected format
    result_json := jsonb_build_object(
      'scheduled_count', COALESCE(result_record.updated_jsi, 0),
      'wrote_slots', COALESCE(result_record.wrote_slots, 0),
      'success', true,
      'mode', 'reschedule_all_sequential',
      'violations', COALESCE(result_record.violations, '[]'::jsonb)
    );
    
  ELSE
    -- For other modes, use the resource-fill scheduler
    RAISE NOTICE 'Using resource-fill scheduler for mode: %', p_mode;
    
    SELECT * INTO result_record 
    FROM public.scheduler_resource_fill_optimized();
    
    -- Normalize the response
    result_json := jsonb_build_object(
      'scheduled_count', COALESCE(result_record.scheduled_count, 0),
      'wrote_slots', COALESCE(result_record.wrote_slots, 0), 
      'success', COALESCE(result_record.success, false),
      'mode', p_mode
    );
  END IF;
  
  RAISE NOTICE 'Scheduler wrapper completed: %', result_json;
  RETURN result_json;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in scheduler wrapper: %', SQLERRM;
  RETURN jsonb_build_object(
    'scheduled_count', 0,
    'wrote_slots', 0,
    'success', false,
    'error', SQLERRM,
    'mode', p_mode
  );
END;
$$;

-- 3. Restore scheduler_append_jobs from working state (from 20250911134400)
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(p_job_ids uuid[], p_start_from timestamptz DEFAULT NULL, p_only_if_unset boolean DEFAULT true)
RETURNS TABLE(updated_jsi integer, wrote_slots integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_id uuid;
  stage_record RECORD;
  base_time timestamptz;
  slot_start timestamptz;
  slot_end timestamptz;
  working_date date;
  total_updated integer := 0;
  total_slots integer := 0;
BEGIN
  -- Use provided start time or default to next working day 8 AM
  IF p_start_from IS NOT NULL THEN
    base_time := p_start_from;
  ELSE
    working_date := CURRENT_DATE + interval '1 day';
    -- Find next working day (skip weekends and holidays)
    WHILE EXTRACT(dow FROM working_date) IN (0, 6) OR EXISTS (
      SELECT 1 FROM public_holidays WHERE date = working_date::date AND is_active = true
    ) LOOP
      working_date := working_date + interval '1 day';
    END LOOP;
    base_time := working_date + time '08:00:00';
  END IF;

  -- Process each job ID
  FOREACH job_id IN ARRAY p_job_ids
  LOOP
    RAISE NOTICE 'Appending job % to schedule starting from %', job_id, base_time;
    
    -- Find the earliest available slot and schedule all pending stages for this job
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.stage_order,
        COALESCE(jsi.estimated_duration_minutes, 60) as duration_minutes,
        ps.name as stage_name,
        pj.wo_no
      FROM job_stage_instances jsi
      JOIN production_stages ps ON jsi.production_stage_id = ps.id
      JOIN production_jobs pj ON jsi.job_id = pj.id
      WHERE jsi.job_id = job_id
        AND jsi.job_table_name = 'production_jobs'
        AND jsi.status = 'pending'
        AND (p_only_if_unset = false OR jsi.scheduled_start_at IS NULL)
      ORDER BY jsi.stage_order
    LOOP
      -- Find next available time for this stage by looking at existing slots
      SELECT COALESCE(MAX(slot_end_time), base_time) INTO slot_start
      FROM stage_time_slots sts
      WHERE sts.production_stage_id = stage_record.production_stage_id
        AND sts.slot_end_time >= base_time;

      -- Ensure we're in working hours (8:00-16:30 with 12:00-12:30 lunch)
      WHILE TRUE LOOP
        -- Check if we're in working hours
        IF EXTRACT(hour FROM slot_start) < 8 THEN
          slot_start := slot_start::date + time '08:00:00';
        ELSIF EXTRACT(hour FROM slot_start) >= 16 OR 
              (EXTRACT(hour FROM slot_start) = 12 AND EXTRACT(minute FROM slot_start) < 30) THEN
          -- Move to next working day
          working_date := (slot_start::date + interval '1 day');
          WHILE EXTRACT(dow FROM working_date) IN (0, 6) OR EXISTS (
            SELECT 1 FROM public_holidays WHERE date = working_date::date AND is_active = true
          ) LOOP
            working_date := working_date + interval '1 day';
          END LOOP;
          slot_start := working_date + time '08:00:00';
        ELSIF EXTRACT(hour FROM slot_start) = 12 AND EXTRACT(minute FROM slot_start) >= 0 THEN
          slot_start := slot_start::date + time '12:30:00';
        ELSE
          EXIT; -- We're in valid working hours
        END IF;
      END LOOP;

      slot_end := slot_start + make_interval(mins => stage_record.duration_minutes);

      -- Update job stage instance with schedule
      UPDATE job_stage_instances 
      SET 
        scheduled_start_at = slot_start,
        scheduled_end_at = slot_end,
        scheduled_minutes = stage_record.duration_minutes,
        schedule_status = 'scheduled',
        updated_at = now()
      WHERE id = stage_record.id;

      -- Create time slot
      INSERT INTO stage_time_slots (
        production_stage_id,
        job_id,
        stage_instance_id,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        job_table_name
      ) VALUES (
        stage_record.production_stage_id,
        job_id,
        stage_record.id,
        slot_start,
        slot_end,
        stage_record.duration_minutes,
        'production_jobs'
      );

      total_updated := total_updated + 1;
      total_slots := total_slots + 1;

      RAISE NOTICE 'Scheduled % for job % from % to %', 
        stage_record.stage_name, stage_record.wo_no, slot_start, slot_end;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT total_updated, total_slots;
END;
$$;

-- 4. Remove all experimental/debugging functions added during troubleshooting
DROP FUNCTION IF EXISTS public.scheduler_wrapper_smoke_test();
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper_debug(text);
DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized_debug();
DROP FUNCTION IF EXISTS public.reschedule_all_with_due_dates();

-- Comment for protection
COMMENT ON FUNCTION public.scheduler_reschedule_all_sequential_fixed(timestamptz) IS 'VERSION 1.0 MILESTONE - PROTECTED - NEVER MODIFY WITHOUT AUTHORIZATION';
COMMENT ON FUNCTION public.simple_scheduler_wrapper(text) IS 'VERSION 1.0 MILESTONE - CRITICAL ROUTING FIX - PROTECTED';

-- Log the restoration
INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'SYSTEM', 'version_1_restoration', 
        'Restored September 24th VERSION 1.0 scheduler configuration - PROTECTED');