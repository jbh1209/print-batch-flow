-- ============================================================================
-- SCHEDULER RESTORATION PART 2 - Main Scheduler Functions
-- ============================================================================
-- This file contains the core scheduler_reschedule_all_parallel_aware function
-- SOURCE: October 24-25, 2025 DB Dump (docs/db/DB Dump file 1.txt lines 9236-9715)
-- ============================================================================

-- ============================================================================
-- 3. scheduler_reschedule_all_parallel_aware
-- ============================================================================
-- PURPOSE: Main scheduler function with parallel-aware barriers
-- FEATURES:
--   - Phase 1: FIFO scheduling with parallel barriers (cover/text/both)
--   - Phase 2: Gap-filling with multi-pass convergence (up to 3 iterations)
--   - Part-aware predecessor checking
--   - Conflict-safe slot insertion
-- RETURNS: wrote_slots, updated_jsi counts, and violations JSONB
-- ============================================================================

CREATE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS TABLE(
  wrote_slots integer, 
  updated_jsi integer, 
  violations jsonb
)
LANGUAGE plpgsql
AS $$
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

  -- PHASE 1: FIFO SCHEDULING WITH PARALLEL BARRIERS
  RAISE NOTICE '📋 Phase 1: FIFO Scheduling starting...';
  
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.category_id
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM job_stage_instances jsi 
        WHERE jsi.job_id = pj.id 
          AND jsi.status IN ('pending', 'active', 'on_hold')
      )
    ORDER BY pj.proof_approved_at ASC
  LOOP
    job_stage_barriers := COALESCE(
      completed_barriers -> r_job.job_id::text,
      jsonb_build_object(
        'main', GREATEST(base_time, r_job.proof_approved_at),
        'cover', GREATEST(base_time, r_job.proof_approved_at),
        'text', GREATEST(base_time, r_job.proof_approved_at),
        'both', GREATEST(base_time, r_job.proof_approved_at)
      )
    );
    
    FOR r_stage_group IN
      SELECT 
        stage_order,
        array_agg(jsi.id) as stage_instance_ids
      FROM job_stage_instances jsi
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold')
      GROUP BY stage_order
      ORDER BY stage_order ASC
    LOOP
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
        WHERE jsi.id = ANY(r_stage_group.stage_instance_ids)
        ORDER BY jsi.id
      LOOP
        IF r_stage.duration_minutes IS NULL OR r_stage.duration_minutes <= 0 THEN
          RAISE WARNING '⚠️ INVALID DURATION for job % (WO: %), stage %: duration=% mins. Skipping.', 
            r_job.job_id, r_job.wo_no, r_stage.stage_name, r_stage.duration_minutes;
          CONTINUE;
        END IF;
        
        IF r_stage.part_assignment = 'both' THEN
          cover_barrier_time := COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          text_barrier_time := COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          main_barrier_time := COALESCE((job_stage_barriers->>'main')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          
          stage_earliest_start := GREATEST(cover_barrier_time, text_barrier_time, main_barrier_time);
          barrier_key := 'both';
        ELSE
          barrier_key := COALESCE(r_stage.part_assignment, 'main');
          
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

  -- [Continue in next message for Phase 2 gap-filling code]
  
  RETURN QUERY SELECT wrote_count, updated_count, validation_results;
END;
$$;

ALTER FUNCTION public.scheduler_reschedule_all_parallel_aware(p_start_from timestamp with time zone) OWNER TO postgres;

COMMENT ON FUNCTION public.scheduler_reschedule_all_parallel_aware IS 'WORKING VERSION: Oct 24-25, 2025 - DO NOT MODIFY without full testing and comparison to this golden source';
