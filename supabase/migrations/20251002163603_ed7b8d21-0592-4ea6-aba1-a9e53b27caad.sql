-- Enhance scheduler_reschedule_all_parallel_aware with Phase 2 gap-filling pass
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  gap_filled_count integer := 0;
  
  -- Job processing variables
  r_job record;
  r_stage_group record;
  r_stage record;
  
  -- Parallel processing variables
  job_stage_barriers jsonb := '{}'::jsonb;
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  max_barrier_time timestamptz;
  
  -- Completed stages tracking
  completed_barriers jsonb;
  barrier_key text;
  
  -- CRITICAL FIX: Variables for proper combined stage handling
  cover_barrier_time timestamptz;
  text_barrier_time timestamptz;
  main_barrier_time timestamptz;
  
  -- Phase 2: Gap-filling variables
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  days_saved numeric;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 42);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting PARALLEL-AWARE scheduler from: %', base_time;

  -- Clear existing non-completed slots only
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  RAISE NOTICE 'Cleared existing non-completed time slots';

  -- CRITICAL FIX: Only clear scheduling data for non-completed stages
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE COALESCE(status, '') NOT IN ('completed', 'active');
  
  RAISE NOTICE 'Cleared scheduling data from non-completed job_stage_instances';

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize stages to base_time, but account for already active slots from completed stages
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

  -- Also initialize any stages not yet tracked
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
  ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE 'Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- ========== PHASE 1: FIFO SEQUENTIAL SCHEDULING ==========
  -- Process jobs in FIFO order by proof_approved_at
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.proof_approved_at,
      pj.wo_no,
      COUNT(jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    WHERE pj.proof_approved_at IS NOT NULL
      AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    -- CRITICAL FIX: Initialize barriers from already-completed stages in this job
    SELECT jsonb_object_agg(
      COALESCE(jsi.part_assignment, 'main'),
      COALESCE(jsi.scheduled_end_at, jsi.completed_at, GREATEST(base_time, r_job.proof_approved_at))
    ) INTO completed_barriers
    FROM job_stage_instances jsi
    WHERE jsi.job_id = r_job.job_id 
      AND jsi.status = 'completed'
      AND (jsi.scheduled_end_at IS NOT NULL OR jsi.completed_at IS NOT NULL);
    
    -- Initialize job barriers with completed stage times or defaults
    job_stage_barriers := COALESCE(completed_barriers, '{}'::jsonb);
    
    -- Ensure all barrier keys exist with minimum values
    job_stage_barriers := job_stage_barriers 
      || jsonb_build_object('main', GREATEST(base_time, r_job.proof_approved_at))
      || jsonb_build_object('cover', COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at)))
      || jsonb_build_object('text', COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at)));
    
    RAISE NOTICE 'Processing job % (WO: %) with % stages - barriers initialized: %', 
      r_job.job_id, r_job.wo_no, r_job.total_stages, job_stage_barriers;
    
    -- Process stages grouped by stage_order to handle parallel stages
    FOR r_stage_group IN
      SELECT 
        stage_order,
        array_agg(jsi.id) as stage_instance_ids,
        array_agg(DISTINCT jsi.part_assignment) FILTER (WHERE jsi.part_assignment IS NOT NULL) as parts_in_group,
        COUNT(*) as stages_in_group
      FROM job_stage_instances jsi
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      GROUP BY stage_order
      ORDER BY stage_order ASC
    LOOP
      RAISE NOTICE 'Processing stage group order % with % stages (parts: %)',
        r_stage_group.stage_order, r_stage_group.stages_in_group, r_stage_group.parts_in_group;
      
      -- Process each stage in this parallel group
      FOR r_stage IN
        SELECT 
          jsi.id as stage_instance_id,
          jsi.production_stage_id,
          jsi.stage_order,
          jsi.part_assignment,
          jsi.dependency_group,
          public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
          ps.name as stage_name
        FROM job_stage_instances jsi
        JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.id = ANY(r_stage_group.stage_instance_ids)
        ORDER BY jsi.id
      LOOP
        -- CRITICAL FIX: Proper barrier calculation for combined stages
        IF r_stage.part_assignment = 'both' THEN
          cover_barrier_time := COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          text_barrier_time := COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          main_barrier_time := COALESCE((job_stage_barriers->>'main')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          
          stage_earliest_start := GREATEST(cover_barrier_time, text_barrier_time, main_barrier_time);
          barrier_key := 'both';
          
          RAISE NOTICE 'COMBINED stage % must wait for: cover=%, text=%, main=% -> using max=%',
            r_stage.stage_name, cover_barrier_time, text_barrier_time, main_barrier_time, stage_earliest_start;
        ELSE
          barrier_key := COALESCE(r_stage.part_assignment, 'main');
          
          IF NOT job_stage_barriers ? barrier_key THEN
            job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(GREATEST(base_time, r_job.proof_approved_at)));
          END IF;
          
          stage_earliest_start := (job_stage_barriers ->> barrier_key)::timestamptz;
        END IF;

        -- Get resource availability
        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        -- Stage must wait for both job barrier and resource availability
        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        RAISE NOTICE 'Scheduling stage % (%): % mins from % (barrier: % = %)',
          r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
          stage_earliest_start, barrier_key, stage_earliest_start;

        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes, 60);
        
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE EXCEPTION 'FAILED to schedule stage % (%) for job % - placement failed at %',
            r_stage.stage_name, r_stage.stage_instance_id, r_job.job_id, stage_earliest_start;
        END IF;

        IF jsonb_array_length(placement_result.slots_created) = 0 THEN
          RAISE EXCEPTION 'FAILED to schedule stage % (%) for job % - no slots created',
            r_stage.stage_name, r_stage.stage_instance_id, r_job.job_id;
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

        -- CRITICAL FIX: Update barriers correctly based on part assignment
        IF r_stage.part_assignment = 'both' THEN
          job_stage_barriers := job_stage_barriers 
            || jsonb_build_object('main', stage_end_time)
            || jsonb_build_object('cover', stage_end_time)
            || jsonb_build_object('text', stage_end_time)
            || jsonb_build_object('both', stage_end_time);
        ELSE
          job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(stage_end_time));
        END IF;

        RAISE NOTICE 'Completed scheduling stage % - ends at % (updated barriers)',
          r_stage.stage_name, stage_end_time;
      END LOOP;
      
      -- Update main barrier to max of all barriers after each stage group
      SELECT GREATEST(
        (job_stage_barriers ->> 'main')::timestamptz,
        COALESCE((job_stage_barriers ->> 'cover')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz),
        COALESCE((job_stage_barriers ->> 'text')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz),
        COALESCE((job_stage_barriers ->> 'both')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz)
      ) INTO max_barrier_time;
      
      job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY['main'], to_jsonb(max_barrier_time));
      
      RAISE NOTICE 'Completed stage group order % - main barrier: %', 
        r_stage_group.stage_order, max_barrier_time;
    END LOOP;
    
    RAISE NOTICE 'Completed job % - final barriers: %', r_job.job_id, job_stage_barriers;
  END LOOP;

  -- ========== PHASE 2: GAP-FILLING OPTIMIZATION PASS ==========
  RAISE NOTICE '🔀 Starting Phase 2: Gap-Filling Optimization Pass';
  
  -- Find all stages eligible for gap-filling
  FOR gap_candidate IN
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.scheduled_start_at,
      jsi.scheduled_end_at,
      jsi.scheduled_minutes,
      ps.name as stage_name,
      ps.allow_gap_filling
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.schedule_status = 'scheduled'
      AND ps.allow_gap_filling = true
      AND jsi.scheduled_minutes IS NOT NULL
      AND jsi.scheduled_minutes <= 120
      AND jsi.scheduled_start_at IS NOT NULL
    ORDER BY jsi.scheduled_start_at DESC -- Process later stages first to avoid cascading issues
  LOOP
    original_start := gap_candidate.scheduled_start_at;
    
    -- Find best gap (earliest available)
    SELECT * INTO best_gap
    FROM find_available_gaps(
      gap_candidate.production_stage_id,
      gap_candidate.scheduled_minutes,
      original_start,
      21 -- 21-day lookback
    )
    ORDER BY gap_start ASC
    LIMIT 1;
    
    -- Only move if found a gap AND it saves ≥1 day
    IF best_gap IS NOT NULL AND best_gap.days_earlier >= 1.0 THEN
      days_saved := best_gap.days_earlier;
      
      RAISE NOTICE '🔀 GAP-FILLING: Moving stage % from % to % (saves %.1f days)',
        gap_candidate.stage_name,
        original_start,
        best_gap.gap_start,
        days_saved;
      
      -- Delete old time slots
      DELETE FROM stage_time_slots 
      WHERE stage_instance_id = gap_candidate.stage_instance_id
        AND COALESCE(is_completed, false) = false;
      
      -- Create new gap-filled slot
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
        gap_candidate.production_stage_id,
        best_gap.gap_start::date,
        best_gap.gap_start,
        best_gap.gap_end,
        gap_candidate.scheduled_minutes,
        gap_candidate.job_id,
        'production_jobs',
        gap_candidate.stage_instance_id,
        false
      );
      
      -- Update job_stage_instances
      UPDATE job_stage_instances
      SET 
        scheduled_start_at = best_gap.gap_start,
        scheduled_end_at = best_gap.gap_end,
        updated_at = now()
      WHERE id = gap_candidate.stage_instance_id;
      
      -- Log the gap-fill
      INSERT INTO schedule_gap_fills(
        job_id,
        stage_instance_id,
        production_stage_id,
        original_scheduled_start,
        gap_filled_start,
        days_saved,
        minutes_saved,
        scheduler_run_type
      )
      VALUES (
        gap_candidate.job_id,
        gap_candidate.stage_instance_id,
        gap_candidate.production_stage_id,
        original_start,
        best_gap.gap_start,
        days_saved,
        (days_saved * 1440)::integer, -- Convert days to minutes
        'reschedule_all'
      );
      
      gap_filled_count := gap_filled_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Gap-filling complete: %  stages moved to earlier time slots', gap_filled_count;

  -- Run validation and collect any violations
  SELECT jsonb_agg(to_jsonb(v)) INTO validation_results
  FROM public.validate_job_scheduling_precedence() v;

  RAISE NOTICE 'PARALLEL-AWARE Scheduler completed: % time slots written, % job stages updated, % gap-filled, % violations found',
    wrote_count, updated_count, gap_filled_count, COALESCE(jsonb_array_length(validation_results), 0);

  RETURN QUERY SELECT wrote_count, updated_count, COALESCE(validation_results, '[]'::jsonb);
END;
$function$;