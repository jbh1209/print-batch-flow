-- Fix dependency handling for 'both' stages and tighten predecessor filters
-- Preserve overall stage-wave approach; no other behavior changes
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(p_job_ids uuid[], p_only_if_unset boolean DEFAULT true)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  
  stage_order_wave integer;
  r_job record;
  r_stage record;
  
  job_stage_barriers jsonb := '{}'::jsonb;
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  stage_start_time timestamptz;
  
  completed_barriers jsonb;
  cover_barrier_time timestamptz;
  text_barrier_time timestamptz;
  main_barrier_time timestamptz;
  barrier_key text;
  
  job_inserted_slot_ids uuid[];
  job_updated_stage_ids uuid[];
  job_failed boolean := false;
  inserted_slot_id uuid;
  
  v_rows integer := 0;
  predecessor_end timestamptz;
  
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  days_saved numeric;
  earliest_possible_start timestamptz;
  v_lookback_days integer;
  gap_filled_end timestamptz;
  gap_filled_count integer := 0;
  pass_iteration integer;
  moved_count integer;
BEGIN
  base_time := public.next_working_start(date_trunc('day', now()) + interval '1 day');
  RAISE NOTICE '🌊 STAGE-WAVE scheduler starting from: %', base_time;

  -- Clear slots if reflow mode
  IF NOT p_only_if_unset THEN
    DELETE FROM stage_time_slots
    WHERE job_id = ANY(p_job_ids)
      AND COALESCE(is_completed, false) = false
      AND slot_start_time >= base_time;
    
    UPDATE job_stage_instances
    SET schedule_status = 'unscheduled',
        scheduled_start_at = NULL,
        scheduled_end_at = NULL,
        scheduled_minutes = NULL,
        updated_at = now()
    WHERE job_id = ANY(p_job_ids)
      AND status IN ('pending', 'on_hold')
      AND (NOT p_only_if_unset OR scheduled_start_at IS NULL);
  END IF;

  PERFORM public.create_stage_availability_tracker();

  -- Build completed barriers per job (FIX: compute 'both' and 'main' as max(cover,text))
  completed_barriers := (
    SELECT jsonb_object_agg(job_id::text,
      jsonb_build_object(
        'main', COALESCE(main_end, base_time),
        'cover', COALESCE(cover_end, base_time),
        'text', COALESCE(text_end, base_time),
        'both', COALESCE(both_end, base_time)
      )
    )
    FROM (
      SELECT
        jsi.job_id,
        -- per-path barriers
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('cover', 'both')) AS cover_end,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('text', 'both')) AS text_end,
        -- 'both' waits for the latest of cover/text
        GREATEST(
          MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('cover', 'both')),
          MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('text', 'both'))
        ) AS both_end,
        -- keep 'main' aligned with convergence of cover/text unless you have a separate main path
        GREATEST(
          MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('cover', 'both')),
          MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('text', 'both'))
        ) AS main_end
      FROM stage_time_slots sts
      JOIN job_stage_instances jsi ON jsi.id = sts.stage_instance_id
      WHERE sts.is_completed = true
        AND jsi.job_id = ANY(p_job_ids)
      GROUP BY jsi.job_id
    ) s
  );

  -- Initialize stage tails with part_assignment
  INSERT INTO _stage_tails(stage_id, part_assignment, next_available_time)
  SELECT 
    sts.production_stage_id,
    jsi.part_assignment,
    COALESCE(MAX(sts.slot_end_time), base_time)
  FROM stage_time_slots sts
  JOIN job_stage_instances jsi ON jsi.id = sts.stage_instance_id
  WHERE sts.slot_end_time >= base_time
  GROUP BY sts.production_stage_id, jsi.part_assignment
  ON CONFLICT (stage_id, part_assignment) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  INSERT INTO _stage_tails(stage_id, part_assignment, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, jsi.part_assignment, base_time
  FROM job_stage_instances jsi
  WHERE jsi.job_id = ANY(p_job_ids)
  ON CONFLICT (stage_id, part_assignment) DO NOTHING;

  -- PHASE 1: STAGE-WAVE SCHEDULING (unchanged loop structure)
  RAISE NOTICE '🌊 Phase 1: STAGE-WAVE Scheduling for % jobs', array_length(p_job_ids, 1);
  
  FOR stage_order_wave IN
    SELECT DISTINCT jsi.stage_order
    FROM job_stage_instances jsi
    WHERE jsi.job_id = ANY(p_job_ids)
      AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold')
      AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
    ORDER BY jsi.stage_order ASC
  LOOP
    RAISE NOTICE '🌊 Processing stage_order wave: %', stage_order_wave;
    
    -- For each stage_order, process all jobs in FIFO order
    FOR r_job IN
      SELECT 
        pj.id as job_id,
        pj.wo_no,
        pj.proof_approved_at,
        pj.category_id
      FROM production_jobs pj
      WHERE pj.id = ANY(p_job_ids)
        AND pj.proof_approved_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM job_stage_instances jsi
          WHERE jsi.job_id = pj.id
            AND jsi.stage_order = stage_order_wave
            AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold')
            AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
        )
      ORDER BY pj.proof_approved_at ASC
    LOOP
      job_inserted_slot_ids := ARRAY[]::uuid[];
      job_updated_stage_ids := ARRAY[]::uuid[];
      job_failed := false;
      
      -- Get or initialize barriers for this job
      job_stage_barriers := COALESCE(
        completed_barriers -> r_job.job_id::text,
        jsonb_build_object(
          'main', GREATEST(base_time, r_job.proof_approved_at),
          'cover', GREATEST(base_time, r_job.proof_approved_at),
          'text', GREATEST(base_time, r_job.proof_approved_at),
          'both', GREATEST(base_time, r_job.proof_approved_at)
        )
      );
      
      -- Process ONLY stages at this stage_order for this job
      FOR r_stage IN
        SELECT 
          jsi.id as stage_instance_id,
          jsi.production_stage_id,
          jsi.stage_order,
          jsi.part_assignment,
          jsi.status,
          public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes, jsi.remaining_minutes, jsi.completion_percentage) as duration_minutes,
          ps.name as stage_name
        FROM job_stage_instances jsi
        JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.job_id = r_job.job_id
          AND jsi.stage_order = stage_order_wave
          AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold')
          AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
        ORDER BY jsi.id
      LOOP
        IF r_stage.duration_minutes IS NULL OR r_stage.duration_minutes <= 0 THEN
          RAISE WARNING '⚠️ INVALID DURATION for job % (WO: %), stage %: duration=% mins. ROLLING BACK JOB.',
            r_job.job_id, r_job.wo_no, r_stage.stage_name, r_stage.duration_minutes;
          job_failed := true;
          EXIT;
        END IF;
        
        -- Calculate barrier-based earliest start (FIX: 'both' depends only on cover+text barriers)
        IF r_stage.part_assignment = 'both' THEN
          cover_barrier_time := COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          text_barrier_time := COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          main_barrier_time := COALESCE((job_stage_barriers->>'main')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          
          stage_earliest_start := GREATEST(cover_barrier_time, text_barrier_time);
          barrier_key := 'both';
        ELSE
          barrier_key := COALESCE(r_stage.part_assignment, 'main');
          
          IF NOT job_stage_barriers ? barrier_key THEN
            job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(GREATEST(base_time, r_job.proof_approved_at)));
          END IF;
          
          stage_earliest_start := (job_stage_barriers ->> barrier_key)::timestamptz;
        END IF;

        -- Read resource availability for this stage+part
        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
          AND part_assignment = r_stage.part_assignment
        FOR UPDATE;

        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        -- Enforce predecessor dependencies with part-aware filtering (FIX: 'both' only checks cover/text paths)
        SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
        FROM job_stage_instances jsi2
        WHERE jsi2.job_id = r_job.job_id
          AND jsi2.stage_order < r_stage.stage_order
          AND jsi2.scheduled_end_at IS NOT NULL
          AND (
            (r_stage.part_assignment = 'both' AND COALESCE(jsi2.part_assignment, 'both') IN ('cover','text','both'))
            OR (COALESCE(r_stage.part_assignment, 'main') = 'text' AND jsi2.part_assignment IN ('text', 'both'))
            OR (COALESCE(r_stage.part_assignment, 'main') = 'cover' AND jsi2.part_assignment IN ('cover', 'both'))
            OR (COALESCE(r_stage.part_assignment, 'main') = 'main' AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
          );

        IF predecessor_end IS NOT NULL AND predecessor_end > stage_earliest_start THEN
          RAISE NOTICE '🔒 Job % (WO: %) stage % (part=%, order %): waiting for predecessor. New earliest: %',
            r_job.job_id, r_job.wo_no, r_stage.stage_name, COALESCE(r_stage.part_assignment, 'main'),
            r_stage.stage_order, predecessor_end;
          stage_earliest_start := predecessor_end;
        END IF;

        -- Place duration
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes, 60);
        
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE WARNING '⚠️ FAILED to schedule stage % for job % (WO: %), ROLLING BACK JOB',
            r_stage.stage_name, r_job.job_id, r_job.wo_no;
          job_failed := true;
          EXIT;
        END IF;

        -- Insert slots
        FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
        LOOP
          INSERT INTO stage_time_slots(
            production_stage_id, date, slot_start_time, slot_end_time,
            duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
          )
          VALUES (
            r_stage.production_stage_id,
            (slot_record ->> 'date')::date,
            (slot_record ->> 'start_time')::timestamptz,
            (slot_record ->> 'end_time')::timestamptz,
            (slot_record ->> 'duration_minutes')::integer,
            r_job.job_id, 'production_jobs', r_stage.stage_instance_id, false
          )
          ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING
          RETURNING id INTO inserted_slot_id;
          
          GET DIAGNOSTICS v_rows = ROW_COUNT;
          IF v_rows = 1 THEN
            job_inserted_slot_ids := array_append(job_inserted_slot_ids, inserted_slot_id);
            wrote_count := wrote_count + 1;
          ELSE
            RAISE WARNING '⚠️ Phase 1 CONFLICT for job % (WO: %), stage % at %. ROLLING BACK JOB.',
              r_job.job_id, r_job.wo_no, r_stage.stage_name, (slot_record->>'start_time')::timestamptz;
            job_failed := true;
            EXIT;
          END IF;
        END LOOP;
        
        IF job_failed THEN
          EXIT;
        END IF;

        -- Get actual scheduled times from inserted slots
        SELECT MIN(slot_start_time), MAX(slot_end_time)
        INTO stage_start_time, stage_end_time
        FROM stage_time_slots
        WHERE stage_instance_id = r_stage.stage_instance_id
          AND COALESCE(is_completed, false) = false;

        IF stage_end_time IS NULL THEN
          RAISE WARNING '⚠️ No slots inserted for stage % (Phase 1), ROLLING BACK JOB', r_stage.stage_instance_id;
          job_failed := true;
          EXIT;
        END IF;

        -- Update resource tail
        UPDATE _stage_tails 
        SET next_available_time = stage_end_time
        WHERE stage_id = r_stage.production_stage_id
          AND part_assignment = r_stage.part_assignment;

        -- Update job_stage_instances
        UPDATE job_stage_instances
        SET 
          scheduled_minutes = r_stage.duration_minutes,
          scheduled_start_at = stage_start_time,
          scheduled_end_at = stage_end_time,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = r_stage.stage_instance_id;
        
        job_updated_stage_ids := array_append(job_updated_stage_ids, r_stage.stage_instance_id);
        updated_count := updated_count + 1;

        -- Update job barriers
        job_stage_barriers := jsonb_set(
          job_stage_barriers,
          ARRAY[barrier_key],
          to_jsonb(stage_end_time)
        );
        
        RAISE NOTICE '✅ Wave % Job % (WO: %) stage % scheduled: % to %',
          stage_order_wave, r_job.job_id, r_job.wo_no, r_stage.stage_name, stage_start_time, stage_end_time;
      END LOOP;
      
      -- Rollback if job failed
      IF job_failed THEN
        RAISE NOTICE '🔄 ROLLING BACK FAILED JOB % (WO: %) in wave % - deleting % slots, reverting % stages',
          r_job.job_id, r_job.wo_no, stage_order_wave, array_length(job_inserted_slot_ids, 1), array_length(job_updated_stage_ids, 1);
        
        DELETE FROM stage_time_slots
        WHERE id = ANY(job_inserted_slot_ids);
        
        UPDATE job_stage_instances
        SET 
          scheduled_minutes = NULL,
          scheduled_start_at = NULL,
          scheduled_end_at = NULL,
          schedule_status = 'unscheduled',
          updated_at = now()
        WHERE id = ANY(job_updated_stage_ids);
        
        wrote_count := wrote_count - COALESCE(array_length(job_inserted_slot_ids, 1), 0);
        updated_count := updated_count - COALESCE(array_length(job_updated_stage_ids, 1), 0);
        
        INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
        VALUES (
          r_job.job_id, 
          r_job.wo_no,
          'append_jobs_ROLLBACK', 
          format('Job scheduling failed in wave %s and was rolled back. Deleted %s slots, reverted %s stages.', 
            stage_order_wave,
            COALESCE(array_length(job_inserted_slot_ids, 1), 0),
            COALESCE(array_length(job_updated_stage_ids, 1), 0))
        );
        
        RAISE NOTICE '❌ Job % (WO: %) scheduling FAILED and rolled back', r_job.job_id, r_job.wo_no;
      ELSE
        -- Store barriers for next wave
        completed_barriers := COALESCE(completed_barriers, '{}'::jsonb);
        completed_barriers := jsonb_set(completed_barriers, ARRAY[r_job.job_id::text], job_stage_barriers);
      END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Wave % complete', stage_order_wave;
  END LOOP;

  RAISE NOTICE '✅ Phase 1 complete: % slots written, % stages scheduled', wrote_count, updated_count;

  -- PHASE 2: GAP-FILLING (unchanged)
  RAISE NOTICE '🔀 Phase 2: Gap-Filling for appended jobs (up to 3 iterations, 120-min cap)';
  
  v_lookback_days := 90;
  
  FOR pass_iteration IN 1..3 LOOP
    moved_count := 0;
    
    RAISE NOTICE '🔀 Phase 2 Pass %/3 starting...', pass_iteration;
    
    FOR gap_candidate IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.job_id,
        jsi.production_stage_id,
        jsi.scheduled_start_at,
        jsi.scheduled_end_at,
        jsi.scheduled_minutes,
        jsi.stage_order,
        jsi.part_assignment,
        ps.name as stage_name,
        ps.allow_gap_filling,
        pj.wo_no
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      JOIN production_jobs pj ON pj.id = jsi.job_id
      WHERE jsi.job_id = ANY(p_job_ids)
        AND jsi.schedule_status = 'scheduled'
        AND ps.allow_gap_filling = true
        AND jsi.scheduled_minutes IS NOT NULL
        AND jsi.scheduled_minutes <= 120
        AND jsi.scheduled_start_at IS NOT NULL
      ORDER BY 
        jsi.job_id,
        jsi.stage_order ASC,
        jsi.scheduled_start_at ASC
    LOOP
      original_start := gap_candidate.scheduled_start_at;
      
      SELECT COALESCE(MAX(jsi2.scheduled_end_at), base_time)
      INTO earliest_possible_start
      FROM job_stage_instances jsi2
      WHERE jsi2.job_id = gap_candidate.job_id
        AND jsi2.stage_order < gap_candidate.stage_order
        AND jsi2.scheduled_end_at IS NOT NULL
        AND (
          (gap_candidate.part_assignment = 'both' AND COALESCE(jsi2.part_assignment, 'both') IN ('cover','text','both'))
          OR (COALESCE(gap_candidate.part_assignment, 'main') = 'text' AND jsi2.part_assignment IN ('text', 'both'))
          OR (COALESCE(gap_candidate.part_assignment, 'main') = 'cover' AND jsi2.part_assignment IN ('cover', 'both'))
          OR (COALESCE(gap_candidate.part_assignment, 'main') = 'main' AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
        );
      
      SELECT * INTO best_gap
      FROM find_available_gaps(
        gap_candidate.production_stage_id,
        gap_candidate.scheduled_minutes,
        original_start,
        v_lookback_days,
        earliest_possible_start
      )
      WHERE gap_start >= earliest_possible_start
      ORDER BY gap_start ASC
      LIMIT 1;
      
      IF best_gap IS NOT NULL 
         AND best_gap.gap_start >= earliest_possible_start 
         AND best_gap.gap_start < original_start THEN
        
        days_saved := EXTRACT(EPOCH FROM (original_start - best_gap.gap_start)) / 86400.0;
        
        RAISE NOTICE '🔀 GAP-FILLING Pass %: Moving stage % (WO: %, order %, part=%) from % to % (saves %.2f days)',
          pass_iteration, gap_candidate.stage_name, gap_candidate.wo_no, gap_candidate.stage_order,
          COALESCE(gap_candidate.part_assignment, 'main'), original_start, best_gap.gap_start, days_saved;
        
        DELETE FROM stage_time_slots 
        WHERE stage_instance_id = gap_candidate.stage_instance_id
          AND COALESCE(is_completed, false) = false;
        
        SELECT * INTO placement_result
        FROM public.place_duration_sql(best_gap.gap_start, gap_candidate.scheduled_minutes, 60);
        
        IF placement_result.placement_success THEN
          FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
          LOOP
            INSERT INTO stage_time_slots(
              production_stage_id, date, slot_start_time, slot_end_time,
              duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
            )
            VALUES (
              gap_candidate.production_stage_id,
              (slot_record ->> 'date')::date,
              (slot_record ->> 'start_time')::timestamptz,
              (slot_record ->> 'end_time')::timestamptz,
              (slot_record ->> 'duration_minutes')::integer,
              gap_candidate.job_id, 'production_jobs', gap_candidate.stage_instance_id, false
            )
            ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING;
            
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            IF v_rows = 0 THEN
              RAISE NOTICE '⏭️ Phase 2 skipped conflicting slot: stage %, start %', 
                gap_candidate.production_stage_id, (slot_record->>'start_time')::timestamptz;
            END IF;
          END LOOP;
          
          SELECT MIN(slot_start_time), MAX(slot_end_time)
          INTO stage_start_time, gap_filled_end
          FROM stage_time_slots
          WHERE stage_instance_id = gap_candidate.stage_instance_id
            AND COALESCE(is_completed, false) = false;
          
          IF gap_filled_end IS NOT NULL THEN
            UPDATE job_stage_instances
            SET 
              scheduled_start_at = stage_start_time,
              scheduled_end_at = gap_filled_end,
              updated_at = now()
            WHERE id = gap_candidate.stage_instance_id;
            
            INSERT INTO schedule_gap_fills(
              job_id, stage_instance_id, production_stage_id,
              original_scheduled_start, gap_filled_start, days_saved,
              minutes_saved, scheduler_run_type
            )
            VALUES (
              gap_candidate.job_id, gap_candidate.stage_instance_id, gap_candidate.production_stage_id,
              original_start, best_gap.gap_start, days_saved,
              (days_saved * 1440)::integer, 'append_jobs'
            );
            
            gap_filled_count := gap_filled_count + 1;
            moved_count := moved_count + 1;
          END IF;
        END IF;
      END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Phase 2 Pass %/3 complete: % stages moved in this pass', pass_iteration, moved_count;
    
    IF moved_count = 0 THEN
      RAISE NOTICE '🎯 Phase 2 converged after % passes', pass_iteration;
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Phase 2 complete: % total stages gap-filled', gap_filled_count;
  RAISE NOTICE '📊 FINAL: % total slots written, % stages updated, % gap-filled', wrote_count, updated_count, gap_filled_count;

  RETURN QUERY SELECT wrote_count, updated_count, validation_results;
END;
$function$;