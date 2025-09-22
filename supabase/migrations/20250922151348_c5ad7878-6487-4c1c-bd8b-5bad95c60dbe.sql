-- CRITICAL FIX: Replace job-centric FIFO with stage-centric FIFO scheduling
-- This fixes the issue where older jobs monopolize resources even when newer jobs' parts are ready

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_sequential_fixed_v2(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  sync_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  clear_result record;
  
  -- Stage processing variables (now single loop)
  r_stage record;
  
  -- CRITICAL FIX: Job barriers now track ACTUAL completion times per part
  job_barriers JSONB := '{}'::jsonb;
  job_part_barriers JSONB := '{}'::jsonb;
  
  -- Scheduling variables
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  actual_start_time timestamptz;
  actual_end_time timestamptz;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 50);

  -- CRITICAL FIX: Properly handle null start time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  -- Verify we have a valid base_time
  IF base_time IS NULL THEN
    RAISE EXCEPTION 'Failed to determine valid base scheduling time';
  END IF;

  RAISE NOTICE 'STAGE-FIFO Scheduler V3: Starting from %', base_time;

  -- Clear ALL non-completed scheduling data to start fresh
  SELECT * INTO clear_result FROM public.clear_non_completed_scheduling_data();
  RAISE NOTICE 'STAGE-FIFO Scheduler V3: Cleared % slots and % instances', clear_result.cleared_slots, clear_result.cleared_instances;

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- CRITICAL FIX: Initialize stages using ACTUAL completion times from completed slots
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

  RAISE NOTICE 'STAGE-FIFO Scheduler V3: Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- ARCHITECTURAL FIX: Pre-calculate job barriers from completed work to seed job_part_barriers
  WITH job_barriers_seed AS (
    SELECT 
      pj.id as job_id,
      -- PRE-CALCULATE job barriers from completed work
      GREATEST(
        base_time,
        COALESCE(pj.proof_approved_at, base_time),
        COALESCE(MAX(jsi_completed.completed_at), base_time)
      ) as calculated_job_barrier,
      -- PRE-CALCULATE part barriers from completed work  
      GREATEST(
        base_time,
        COALESCE(pj.proof_approved_at, base_time),
        COALESCE(MAX(CASE WHEN jsi_completed.part_assignment = 'cover' THEN jsi_completed.completed_at END), base_time)
      ) as cover_barrier,
      GREATEST(
        base_time,
        COALESCE(pj.proof_approved_at, base_time),
        COALESCE(MAX(CASE WHEN jsi_completed.part_assignment = 'text' THEN jsi_completed.completed_at END), base_time)
      ) as text_barrier,
      GREATEST(
        base_time,
        COALESCE(pj.proof_approved_at, base_time),
        COALESCE(MAX(CASE WHEN jsi_completed.part_assignment = 'both' THEN jsi_completed.completed_at END), base_time)
      ) as both_barrier
    FROM production_jobs pj
    -- Include ALL stages for barrier calculation, not just pending
    LEFT JOIN job_stage_instances jsi_completed ON jsi_completed.job_id = pj.id 
      AND COALESCE(jsi_completed.status, '') = 'completed'
      AND jsi_completed.completed_at IS NOT NULL
    WHERE pj.proof_approved_at IS NOT NULL  -- Only process proof-approved jobs
      AND EXISTS (
        SELECT 1 FROM job_stage_instances jsi_check 
        WHERE jsi_check.job_id = pj.id 
          AND COALESCE(jsi_check.status, '') NOT IN ('completed', 'active')
      ) -- Only jobs with pending work
    GROUP BY pj.id, pj.proof_approved_at
  )
  SELECT jsonb_object_agg(
    job_id::text, 
    jsonb_build_object(
      'cover', cover_barrier,
      'text', text_barrier, 
      'both', both_barrier
    )
  ) INTO job_part_barriers
  FROM job_barriers_seed;
  
  -- Ensure job_part_barriers is never null
  job_part_barriers := COALESCE(job_part_barriers, '{}'::jsonb);

  RAISE NOTICE 'STAGE-FIFO V3: Pre-seeded part barriers for % jobs', jsonb_object_keys(job_part_barriers);

  -- ARCHITECTURAL BREAKTHROUGH: Single stage-centric loop with global FIFO ordering
  -- This eliminates job-monopolizing behavior by processing stages globally by eligible time
  FOR r_stage IN
    WITH pending_stages AS (
      SELECT 
        jsi.id as stage_instance_id,
        jsi.job_id,
        jsi.production_stage_id,
        jsi.stage_order,
        jsi.part_assignment,
        jsi.status,
        public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
        ps.name as stage_name,
        pj.proof_approved_at,
        pj.wo_no,
        -- CRITICAL: Calculate part-aware eligible time for GLOBAL ordering
        CASE 
          WHEN jsi.part_assignment = 'cover' THEN
            -- Cover stages only wait for previous cover work
            COALESCE((job_part_barriers.barriers ->> 'cover')::timestamptz, GREATEST(base_time, COALESCE(pj.proof_approved_at, base_time)))
          WHEN jsi.part_assignment = 'text' THEN
            -- Text stages only wait for previous text work
            COALESCE((job_part_barriers.barriers ->> 'text')::timestamptz, GREATEST(base_time, COALESCE(pj.proof_approved_at, base_time)))
          WHEN jsi.part_assignment = 'both' THEN
            -- 'Both' stages wait for ALL prerequisite parts (convergence point)
            GREATEST(
              COALESCE((job_part_barriers.barriers ->> 'cover')::timestamptz, GREATEST(base_time, COALESCE(pj.proof_approved_at, base_time))),
              COALESCE((job_part_barriers.barriers ->> 'text')::timestamptz, GREATEST(base_time, COALESCE(pj.proof_approved_at, base_time))),
              GREATEST(base_time, COALESCE(pj.proof_approved_at, base_time))
            )
          ELSE
            -- Default stages (no part assignment) use job-level barrier
            GREATEST(base_time, COALESCE(pj.proof_approved_at, base_time))
        END as eligible_time
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      JOIN production_jobs pj ON pj.id = jsi.job_id
      -- Join with pre-calculated barriers
      LEFT JOIN (
        SELECT 
          job_id::text as job_key,
          jsonb_extract_path(job_part_barriers, job_id::text) as barriers
        FROM (
          SELECT DISTINCT jsi_inner.job_id 
          FROM job_stage_instances jsi_inner 
          WHERE COALESCE(jsi_inner.status, '') NOT IN ('completed', 'active')
        ) jobs_with_pending
      ) job_part_barriers ON job_part_barriers.job_key = jsi.job_id::text
      WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
        AND pj.proof_approved_at IS NOT NULL
    )
    SELECT 
      stage_instance_id,
      job_id,
      production_stage_id,
      stage_order,
      part_assignment,
      duration_minutes,
      stage_name,
      proof_approved_at,
      wo_no,
      eligible_time
    FROM pending_stages
    -- GLOBAL STAGE-LEVEL FIFO: Order by eligible time first, then FIFO within same time
    ORDER BY 
      eligible_time ASC,           -- Stage can start when its part prerequisites are done
      proof_approved_at ASC,       -- FIFO for stages ready at same time
      stage_order ASC,             -- Workflow order within same job
      stage_instance_id ASC        -- Deterministic tie-breaker
  LOOP
    -- Get current resource availability
    SELECT next_available_time INTO resource_available_time
    FROM _stage_tails 
    WHERE stage_id = r_stage.production_stage_id
    FOR UPDATE;

    -- Ensure resource time is never null
    resource_available_time := COALESCE(resource_available_time, base_time);

    -- CRITICAL: Stage MUST wait for BOTH part completion AND resource availability
    stage_earliest_start := GREATEST(r_stage.eligible_time, resource_available_time);

    RAISE NOTICE 'STAGE-FIFO V3: Scheduling %: job=% part=% order=% duration=%min, earliest_start=%, eligible_time=%, resource_avail=%',
      r_stage.stage_name, r_stage.wo_no, COALESCE(r_stage.part_assignment, 'default'), r_stage.stage_order, r_stage.duration_minutes, 
      stage_earliest_start, r_stage.eligible_time, resource_available_time;

    -- Place the duration using enhanced placement
    SELECT * INTO placement_result
    FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
    
    IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
      RAISE EXCEPTION 'CRITICAL FAILURE: Cannot schedule stage % for job % at %',
        r_stage.stage_name, r_stage.job_id, stage_earliest_start;
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
        r_stage.job_id,
        'production_jobs',
        r_stage.stage_instance_id,
        false
      );
      wrote_count := wrote_count + 1;
    END LOOP;

    -- CRITICAL FIX: Calculate ACTUAL times from created slots
    SELECT 
      MIN((time_slot ->> 'start_time')::timestamptz),
      MAX((time_slot ->> 'end_time')::timestamptz)
    INTO actual_start_time, actual_end_time
    FROM jsonb_array_elements(placement_result.slots_created) time_slot;

    -- Ensure times are never null
    actual_start_time := COALESCE(actual_start_time, stage_earliest_start);
    actual_end_time := COALESCE(actual_end_time, actual_start_time + make_interval(mins => r_stage.duration_minutes));

    -- CRITICAL FIX: Update resource availability immediately
    UPDATE _stage_tails 
    SET next_available_time = actual_end_time
    WHERE stage_id = r_stage.production_stage_id;

    -- CRITICAL FIX: Update job stage instance with ACTUAL calculated times from slots
    UPDATE job_stage_instances
    SET 
      scheduled_minutes = r_stage.duration_minutes,
      scheduled_start_at = actual_start_time,    -- Use ACTUAL slot start time
      scheduled_end_at = actual_end_time,        -- Use ACTUAL slot end time  
      schedule_status = 'scheduled',
      updated_at = now()
    WHERE id = r_stage.stage_instance_id;
    updated_count := updated_count + 1;

    -- CRITICAL FIX: Update part-specific barriers dynamically for remaining stages
    IF r_stage.part_assignment IN ('cover', 'text', 'both') THEN
      job_part_barriers := jsonb_set(
        job_part_barriers, 
        ARRAY[r_stage.job_id::text, r_stage.part_assignment], 
        to_jsonb(actual_end_time)
      );
      
      RAISE NOTICE 'STAGE-FIFO V3: Updated %s barrier to %s for job %s (affects remaining stages)',
        r_stage.part_assignment, actual_end_time, r_stage.job_id;
    END IF;

    RAISE NOTICE 'STAGE-FIFO V3: Completed stage % - ACTUAL times: %s to %s',
      r_stage.stage_name, actual_start_time, actual_end_time;
  END LOOP;

  -- CRITICAL NEW STEP: Final synchronization - ensure JSI times match actual STS times
  RAISE NOTICE 'FINAL SYNC: Synchronizing JSI times with actual STS slot times...';
  
  UPDATE job_stage_instances jsi
  SET 
    scheduled_start_at = slot_times.actual_start,
    scheduled_end_at = slot_times.actual_end,
    updated_at = now()
  FROM (
    SELECT 
      sts.stage_instance_id,
      MIN(sts.slot_start_time) as actual_start,
      MAX(sts.slot_end_time) as actual_end
    FROM stage_time_slots sts
    WHERE sts.stage_instance_id IS NOT NULL
      AND COALESCE(sts.is_completed, false) = false
    GROUP BY sts.stage_instance_id
  ) slot_times
  WHERE jsi.id = slot_times.stage_instance_id
    AND (
      jsi.scheduled_start_at != slot_times.actual_start OR
      jsi.scheduled_end_at != slot_times.actual_end OR
      jsi.scheduled_start_at IS NULL OR
      jsi.scheduled_end_at IS NULL
    );
  
  GET DIAGNOSTICS sync_count = ROW_COUNT;
  RAISE NOTICE 'FINAL SYNC: Synchronized % job stage instances with actual slot times', sync_count;

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

  RAISE NOTICE 'STAGE-FIFO Sequential Scheduler V3 COMPLETE: % slots written, % instances updated, % synced, % violations remain', 
    wrote_count, updated_count, sync_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'STAGE-FIFO Sequential Scheduler V3 failed: %', SQLERRM;
END;
$function$;