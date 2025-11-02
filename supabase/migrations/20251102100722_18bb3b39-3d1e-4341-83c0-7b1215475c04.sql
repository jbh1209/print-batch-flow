-- Increase gap-filling duration cap from 120 to 480 minutes
-- This allows Wire Binding (184 min), Perfect Binding (370-470 min), 
-- Pre Trim (615-927 min), and other longer stages to participate in Phase 2 gap-filling

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
  
  r_job record;
  r_stage_group record;
  r_stage record;
  
  job_stage_barriers jsonb := '{}'::jsonb;
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  
  completed_barriers jsonb;
  cover_barrier_time timestamptz;
  text_barrier_time timestamptz;
  main_barrier_time timestamptz;
  barrier_key text;
  
  -- Gap-filling variables
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  days_saved numeric;
  earliest_possible_start timestamptz;
  v_lookback_days integer;
  predecessor_end timestamptz;
  gap_filled_end timestamptz;
  
  expired_count integer := 0;
  on_hold_count integer := 0;
  
  -- Multi-pass convergence variables
  pass_iteration integer;
  moved_count integer;
  
  -- Conflict-safety variables
  v_rows integer := 0;
  stage_start_time timestamptz;
BEGIN
  -- Base time logic: tomorrow for manual runs, provided time for cron
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now()) + interval '1 day');
    RAISE NOTICE '🔄 Manual reschedule starting from TOMORROW: %', base_time;
  ELSE
    base_time := public.next_working_start(p_start_from);
    RAISE NOTICE '🔄 Scheduled reschedule starting from: %', base_time;
  END IF;

  -- Clean up expired and on-hold stages
  DELETE FROM stage_time_slots
  WHERE COALESCE(is_completed, false) = false
    AND slot_start_time >= base_time;

  expired_count := (SELECT COUNT(*)::integer 
    FROM job_stage_instances 
    WHERE schedule_status IN ('scheduled', 'auto_held')
      AND scheduled_start_at < now() - interval '7 days');
  
  UPDATE job_stage_instances
  SET schedule_status = 'expired',
      scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = NULL,
      updated_at = now()
  WHERE schedule_status IN ('scheduled', 'auto_held')
    AND scheduled_start_at < now() - interval '7 days';

  on_hold_count := (SELECT COUNT(*)::integer 
    FROM job_stage_instances 
    WHERE status = 'on_hold');
  
  UPDATE job_stage_instances
  SET schedule_status = 'unscheduled',
      scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = NULL,
      updated_at = now()
  WHERE status IN ('pending', 'on_hold')
    AND schedule_status != 'expired';

  PERFORM public.create_stage_availability_tracker();

  -- Compute completed barriers per job
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
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment = 'both') AS both_end,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('cover', 'both')) AS cover_end,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('text', 'both')) AS text_end,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment = 'both') AS main_end
      FROM stage_time_slots sts
      JOIN job_stage_instances jsi ON jsi.id = sts.stage_instance_id
      WHERE sts.is_completed = true
      GROUP BY jsi.job_id
    ) s
  );

  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    COALESCE(MAX(slot_end_time), base_time)
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  ON CONFLICT (stage_id) DO NOTHING;

  -- PHASE 1: Sequential scheduling
  RAISE NOTICE '📅 Phase 1: Sequential scheduling (precedence-aware, resource-constrained)';
  
  FOR r_job IN
    SELECT DISTINCT 
      jsi.job_id,
      pj.wo_no,
      pj.proof_approved_at
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.status = 'pending'
      AND jsi.schedule_status IN ('unscheduled', 'expired')
    ORDER BY COALESCE(pj.proof_approved_at, pj.created_at) ASC
  LOOP
    FOR r_stage_group IN
      SELECT DISTINCT stage_order
      FROM job_stage_instances jsi
      WHERE jsi.job_id = r_job.job_id
        AND jsi.status = 'pending'
        AND jsi.schedule_status IN ('unscheduled', 'expired')
      ORDER BY stage_order ASC
    LOOP
      FOR r_stage IN
        SELECT 
          jsi.id as stage_instance_id,
          jsi.job_id,
          jsi.production_stage_id,
          jsi.part_assignment,
          jsi.stage_order,
          ps.name as stage_name,
          ps.duration_minutes,
          ps.stage_type,
          ps.resource_type
        FROM job_stage_instances jsi
        JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.job_id = r_job.job_id
          AND jsi.stage_order = r_stage_group.stage_order
          AND jsi.status = 'pending'
          AND jsi.schedule_status IN ('unscheduled', 'expired')
        ORDER BY jsi.part_assignment ASC
      LOOP
        stage_earliest_start := base_time;

        IF r_stage.stage_type = 'PROOF' THEN
          barrier_key := r_job.job_id::text || '_proof';
          
          IF NOT job_stage_barriers ? barrier_key THEN
            job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(GREATEST(base_time, r_job.proof_approved_at)));
          END IF;
          
          stage_earliest_start := (job_stage_barriers ->> barrier_key)::timestamptz;
        END IF;

        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        -- CRITICAL: Enforce sequential stage order WITH PART-AWARE FILTERING
        SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
        FROM job_stage_instances jsi2
        WHERE jsi2.job_id = r_job.job_id
          AND jsi2.stage_order < r_stage.stage_order
          AND jsi2.scheduled_end_at IS NOT NULL
          AND (
            -- If current stage is 'both', wait for everything (convergence point)
            r_stage.part_assignment = 'both'
            OR
            -- If current stage is 'text', only wait for text and both stages
            (COALESCE(r_stage.part_assignment, 'main') = 'text' 
             AND jsi2.part_assignment IN ('text', 'both'))
            OR
            -- If current stage is 'cover', only wait for cover and both stages
            (COALESCE(r_stage.part_assignment, 'main') = 'cover' 
             AND jsi2.part_assignment IN ('cover', 'both'))
            OR
            -- If current stage is 'main' (or NULL), wait for main and both stages
            (COALESCE(r_stage.part_assignment, 'main') = 'main' 
             AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
          );

        IF predecessor_end IS NOT NULL AND predecessor_end > stage_earliest_start THEN
          RAISE NOTICE '🔒 Job % (WO: %) stage % (part=%, order %): waiting for %+both predecessor. New earliest: %',
            r_job.job_id, r_job.wo_no, r_stage.stage_name, COALESCE(r_stage.part_assignment, 'main'), 
            r_stage.stage_order, COALESCE(r_stage.part_assignment, 'main'), predecessor_end;
          stage_earliest_start := predecessor_end;
        END IF;

        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes, 60);
        
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE WARNING '⚠️ FAILED to schedule stage % for job %, skipping', r_stage.stage_name, r_job.job_id;
          CONTINUE;
        END IF;

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
          ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING;
          
          GET DIAGNOSTICS v_rows = ROW_COUNT;
          IF v_rows = 1 THEN
            wrote_count := wrote_count + 1;
          ELSE
            RAISE NOTICE '⏭️ Phase 1 skipped conflicting slot: stage %, start %', 
              r_stage.production_stage_id, (slot_record->>'start_time')::timestamptz;
          END IF;
        END LOOP;

        SELECT MIN(slot_start_time), MAX(slot_end_time)
        INTO stage_start_time, stage_end_time
        FROM stage_time_slots
        WHERE stage_instance_id = r_stage.stage_instance_id
          AND COALESCE(is_completed, false) = false;

        IF stage_end_time IS NULL THEN
          RAISE NOTICE '⏭️ No slots inserted for stage % (Phase 1), skipping updates', r_stage.stage_instance_id;
          CONTINUE;
        END IF;

        UPDATE _stage_tails 
        SET next_available_time = stage_end_time
        WHERE stage_id = r_stage.production_stage_id;

        UPDATE job_stage_instances
        SET 
          scheduled_minutes = r_stage.duration_minutes,
          scheduled_start_at = stage_start_time,
          scheduled_end_at = stage_end_time,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = r_stage.stage_instance_id;
        updated_count := updated_count + 1;

        job_stage_barriers := jsonb_set(
          job_stage_barriers,
          ARRAY[barrier_key],
          to_jsonb(stage_end_time)
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ Phase 1 complete: % slots written, % stages scheduled', wrote_count, updated_count;

  -- PHASE 2: GAP-FILLING WITH PART-AWARE PREDECESSOR CHECK
  RAISE NOTICE '🔀 Phase 2: Gap-Filling with multi-pass convergence (up to 3 iterations)';
  
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
      WHERE jsi.schedule_status = 'scheduled'
        AND ps.allow_gap_filling = true
        AND jsi.scheduled_minutes IS NOT NULL
        AND jsi.scheduled_minutes <= 480  -- CHANGED from 120 to 480 (8 hours)
        AND jsi.scheduled_start_at IS NOT NULL
      ORDER BY 
        jsi.job_id,
        jsi.stage_order ASC,
        jsi.scheduled_start_at ASC
    LOOP
      original_start := gap_candidate.scheduled_start_at;
      
      -- CRITICAL: Calculate earliest_possible_start WITH PART-AWARE FILTERING
      SELECT COALESCE(MAX(jsi2.scheduled_end_at), base_time)
      INTO earliest_possible_start
      FROM job_stage_instances jsi2
      WHERE jsi2.job_id = gap_candidate.job_id
        AND jsi2.stage_order < gap_candidate.stage_order
        AND jsi2.scheduled_end_at IS NOT NULL
        AND (
          -- If current stage is 'both', wait for everything (convergence point)
          gap_candidate.part_assignment = 'both'
          OR
          -- If current stage is 'text', only wait for text and both stages
          (COALESCE(gap_candidate.part_assignment, 'main') = 'text' 
           AND jsi2.part_assignment IN ('text', 'both'))
          OR
          -- If current stage is 'cover', only wait for cover and both stages
          (COALESCE(gap_candidate.part_assignment, 'main') = 'cover' 
           AND jsi2.part_assignment IN ('cover', 'both'))
          OR
          -- If current stage is 'main' (or NULL), wait for main and both stages
          (COALESCE(gap_candidate.part_assignment, 'main') = 'main' 
           AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
        );

      RAISE NOTICE '🔍 Part-aware predecessor check for % (part=%): earliest_possible=% (only checked %+both predecessors)',
        gap_candidate.stage_name, COALESCE(gap_candidate.part_assignment, 'main'), 
        earliest_possible_start, COALESCE(gap_candidate.part_assignment, 'main');
      
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
        
        IF days_saved >= 0.25 THEN
          DELETE FROM stage_time_slots
          WHERE stage_instance_id = gap_candidate.stage_instance_id
            AND COALESCE(is_completed, false) = false;
          
          SELECT * INTO placement_result
          FROM public.place_duration_sql(best_gap.gap_start, gap_candidate.scheduled_minutes, 60);
          
          IF placement_result.placement_success AND placement_result.slots_created IS NOT NULL THEN
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
              IF v_rows = 1 THEN
                wrote_count := wrote_count + 1;
              ELSE
                RAISE NOTICE '⏭️ Phase 2 skipped conflicting slot for stage %, start %', 
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
                stage_instance_id,
                production_stage_id,
                job_id,
                original_start,
                new_start,
                days_saved,
                scheduler_run_type
              ) VALUES (
                gap_candidate.stage_instance_id,
                gap_candidate.production_stage_id,
                gap_candidate.job_id,
                original_start,
                stage_start_time,
                days_saved,
                'reschedule_all'
              );
              
              gap_filled_count := gap_filled_count + 1;
              moved_count := moved_count + 1;
              
              RAISE NOTICE '✅ Gap-fill successful: stage % moved from % to % (saved %.2f days)',
                gap_candidate.stage_name, original_start, stage_start_time, days_saved;
            ELSE
              RAISE WARNING '⚠️ Gap-fill failed: no slots created for stage %', gap_candidate.stage_instance_id;
            END IF;
          ELSE
            RAISE WARNING '⚠️ Gap-fill placement failed for stage %', gap_candidate.stage_instance_id;
          END IF;
        ELSE
          RAISE NOTICE '⏭️ Skipping gap-fill: only saves %.2f days (< 0.25 threshold)', days_saved;
        END IF;
      END IF;
    END LOOP;
    
    RAISE NOTICE '🔀 Phase 2 Pass %/3 complete: % stages moved', pass_iteration, moved_count;
    
    IF moved_count = 0 THEN
      RAISE NOTICE '✅ Phase 2 converged early at pass %', pass_iteration;
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Phase 2 complete: % total stages gap-filled across all passes', gap_filled_count;

  -- Validation
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

  RETURN QUERY SELECT wrote_count, updated_count, COALESCE(validation_results, '[]'::jsonb);
END;
$function$;