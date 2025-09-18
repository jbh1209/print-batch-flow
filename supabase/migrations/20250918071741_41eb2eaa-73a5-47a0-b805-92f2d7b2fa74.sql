-- Fix parallel processing issue in scheduler
-- The problem: scheduler was updating job barriers after each individual stage,
-- breaking parallel processing for stages with same stage_order (text/cover printing)

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_sequential_fixed(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
  
  -- Job processing variables
  r_job record;
  r_stage record;
  current_layer_order integer;
  layer_end_times timestamptz[];
  
  -- CRITICAL: Job-level barriers for sequential processing with part tracking
  job_barriers JSONB := '{}'::jsonb;
  job_part_barriers JSONB := '{}'::jsonb; -- Track per-part completion times
  
  -- Scheduling variables
  resource_available_time timestamptz;
  job_current_barrier timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
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

  RAISE NOTICE 'PARALLEL-AWARE Sequential Scheduler: Starting from %', base_time;

  -- Clear ALL non-completed scheduling data to start fresh
  SELECT * INTO clear_result FROM public.clear_non_completed_scheduling_data();
  RAISE NOTICE 'PARALLEL-AWARE Scheduler: Cleared % slots and % instances', clear_result.cleared_slots, clear_result.cleared_instances;

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

  RAISE NOTICE 'PARALLEL-AWARE Scheduler: Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- CRITICAL FIX: Process jobs in FIFO order with LAYER-BASED barriers
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
    -- INITIALIZE job barrier for THIS SPECIFIC JOB - ensure it's never null
    job_current_barrier := GREATEST(base_time, COALESCE(r_job.proof_approved_at, base_time));
    
    -- Store this job's barrier and initialize part barriers
    job_barriers := jsonb_set(job_barriers, ARRAY[r_job.job_id::text], to_jsonb(job_current_barrier));
    job_part_barriers := jsonb_set(job_part_barriers, ARRAY[r_job.job_id::text], '{
      "cover": null,
      "text": null,
      "both": null
    }'::jsonb);
    
    RAISE NOTICE 'PARALLEL-AWARE: Starting job % (WO: %) - INITIAL barrier: %', 
      r_job.job_id, r_job.wo_no, job_current_barrier;
    
    -- NEW: Process stages in LAYERS (same stage_order processed in parallel)
    current_layer_order := -1;
    layer_end_times := ARRAY[]::timestamptz[];
    
    FOR r_stage IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.production_stage_id,
        jsi.stage_order,
        jsi.part_assignment,
        public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      ORDER BY COALESCE(jsi.stage_order, 999999) ASC, jsi.id ASC
    LOOP
      -- LAYER-BASED PROCESSING: Check if we're starting a new layer
      IF r_stage.stage_order != current_layer_order THEN
        -- We've finished the previous layer, update job barrier to latest end time
        IF array_length(layer_end_times, 1) > 0 THEN
          job_current_barrier := (SELECT MAX(t) FROM unnest(layer_end_times) AS t);
          job_barriers := jsonb_set(job_barriers, ARRAY[r_job.job_id::text], to_jsonb(job_current_barrier));
          
          RAISE NOTICE 'LAYER COMPLETE: Job % advanced barrier to % after layer %', 
            r_job.job_id, job_current_barrier, current_layer_order;
        END IF;
        
        -- Start new layer
        current_layer_order := r_stage.stage_order;
        layer_end_times := ARRAY[]::timestamptz[];
        
        -- Get updated job barrier for new layer
        job_current_barrier := COALESCE((job_barriers ->> r_job.job_id::text)::timestamptz, base_time);
      END IF;
      
      -- ENHANCED CONVERGENCE LOGIC: For 'both' stages, wait for ALL prerequisite parts
      IF r_stage.part_assignment = 'both' THEN
        DECLARE
          job_part_data jsonb;
          cover_end_time timestamptz;
          text_end_time timestamptz;
          convergence_barrier timestamptz;
        BEGIN
          -- Get part completion times for this job
          job_part_data := job_part_barriers -> r_job.job_id::text;
          cover_end_time := COALESCE((job_part_data ->> 'cover')::timestamptz, base_time);
          text_end_time := COALESCE((job_part_data ->> 'text')::timestamptz, base_time);
          
          -- Convergence point: wait for the LATEST of all prerequisite parts
          convergence_barrier := GREATEST(job_current_barrier, cover_end_time, text_end_time);
          
          RAISE NOTICE 'CONVERGENCE: Stage % waits for cover=%s, text=%s, job_barrier=%s -> using %s',
            r_stage.stage_name, cover_end_time, text_end_time, job_current_barrier, convergence_barrier;
          
          job_current_barrier := convergence_barrier;
        END;
      END IF;
      
      -- Get resource availability
      SELECT next_available_time INTO resource_available_time
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id
      FOR UPDATE;

      -- Ensure resource time is never null
      resource_available_time := COALESCE(resource_available_time, base_time);

      -- CRITICAL: Stage MUST wait for BOTH job completion AND resource availability
      stage_earliest_start := GREATEST(job_current_barrier, resource_available_time);

      RAISE NOTICE 'PARALLEL-AWARE: Scheduling %: part=%, order=%, duration=%min, earliest_start=%, job_barrier=%, resource_avail=%',
        r_stage.stage_name, COALESCE(r_stage.part_assignment, 'default'), r_stage.stage_order, r_stage.duration_minutes, 
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

      -- ENHANCED: Update part-specific barriers for convergence tracking
      IF r_stage.part_assignment IN ('cover', 'text') THEN
        job_part_barriers := jsonb_set(
          job_part_barriers, 
          ARRAY[r_job.job_id::text, r_stage.part_assignment], 
          to_jsonb(actual_end_time)
        );
        
        RAISE NOTICE 'PART TRACKING: Updated %s barrier to %s for job %s',
          r_stage.part_assignment, actual_end_time, r_job.job_id;
      END IF;

      -- NEW: Add this stage's end time to current layer (DON'T update job barrier yet)
      layer_end_times := array_append(layer_end_times, actual_end_time);

      RAISE NOTICE 'PARALLEL-AWARE: Completed stage % - ACTUAL times: %s to %s - ADDED to layer %s',
        r_stage.stage_name, actual_start_time, actual_end_time, current_layer_order;
    END LOOP;
    
    -- CRITICAL: Process final layer for this job
    IF array_length(layer_end_times, 1) > 0 THEN
      job_current_barrier := (SELECT MAX(t) FROM unnest(layer_end_times) AS t);
      job_barriers := jsonb_set(job_barriers, ARRAY[r_job.job_id::text], to_jsonb(job_current_barrier));
      
      RAISE NOTICE 'FINAL LAYER: Job % completed with final barrier: %', 
        r_job.job_id, job_current_barrier;
    END IF;
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

  RAISE NOTICE 'PARALLEL-AWARE Sequential Scheduler COMPLETE: % slots written, % instances updated, % synced, % violations remain', 
    wrote_count, updated_count, sync_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'PARALLEL-AWARE Sequential Scheduler failed: %', SQLERRM;
END;
$function$;