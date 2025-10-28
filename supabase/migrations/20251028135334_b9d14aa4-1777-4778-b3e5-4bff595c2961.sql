-- RESTORATION: Oct 11 Working Scheduler with Surgical Division Filters
-- This restores the last known-working scheduler before divisions were introduced
-- and adds minimal WHERE clauses for division filtering

-- Drop all broken Oct 25+ scheduler functions
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_by_division(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID[]) CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_by_division(TEXT, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(UUID[], BOOLEAN, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(UUID[], BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(TIMESTAMPTZ, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID[], TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(TEXT, TIMESTAMPTZ) CASCADE;

-- ============================================================================
-- RESTORE: scheduler_append_jobs (Oct 10 version with 120-minute cap)
-- SURGICAL ADDITION: p_division parameter + 1 WHERE clause in _stage_tails
-- ============================================================================
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[], 
  p_only_if_unset boolean DEFAULT true,
  p_division TEXT DEFAULT NULL
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  gap_filled_count integer := 0;
  r_stage record;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  resource_available_time timestamptz;
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  days_saved numeric;
BEGIN
  base_time := public.next_working_start(now());
  RAISE NOTICE 'Starting append-only scheduler for % jobs from: %', array_length(p_job_ids, 1), base_time;
  PERFORM public.create_stage_availability_tracker();
  
  -- SURGICAL DIVISION FILTER: _stage_tails initialization
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    sts.production_stage_id, 
    COALESCE(MAX(sts.slot_end_time), base_time)
  FROM stage_time_slots sts
  JOIN production_stages ps ON ps.id = sts.production_stage_id
  WHERE COALESCE(sts.is_completed, false) = true
    AND (p_division IS NULL OR ps.division = p_division)
  GROUP BY sts.production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE jsi.job_id = ANY(p_job_ids)
  ON CONFLICT (stage_id) DO NOTHING;

  FOR r_stage IN
    SELECT 
      jsi.id as stage_instance_id, jsi.job_id, jsi.production_stage_id, jsi.stage_order,
      public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
      ps.name as stage_name, pj.proof_approved_at, pj.wo_no
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.job_id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NOT NULL
      AND jsi.status = 'pending'
      AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
    ORDER BY pj.proof_approved_at ASC, jsi.stage_order ASC
  LOOP
    SELECT next_available_time INTO resource_available_time
    FROM _stage_tails WHERE stage_id = r_stage.production_stage_id FOR UPDATE;
    resource_available_time := GREATEST(resource_available_time, r_stage.proof_approved_at, base_time);
    SELECT * INTO placement_result FROM public.place_duration_sql(resource_available_time, r_stage.duration_minutes, 60);
    
    IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
      RAISE EXCEPTION 'FAILED to append stage % for job %', r_stage.stage_name, r_stage.job_id;
    END IF;

    FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created) LOOP
      INSERT INTO stage_time_slots(production_stage_id, date, slot_start_time, slot_end_time, duration_minutes, job_id, job_table_name, stage_instance_id, is_completed)
      VALUES (r_stage.production_stage_id, (slot_record ->> 'date')::date, (slot_record ->> 'start_time')::timestamptz, (slot_record ->> 'end_time')::timestamptz, (slot_record ->> 'duration_minutes')::integer, r_stage.job_id, 'production_jobs', r_stage.stage_instance_id, false);
      wrote_count := wrote_count + 1;
    END LOOP;

    SELECT MAX((time_slot ->> 'end_time')::timestamptz) INTO stage_end_time FROM jsonb_array_elements(placement_result.slots_created) time_slot;
    UPDATE _stage_tails SET next_available_time = stage_end_time WHERE stage_id = r_stage.production_stage_id;
    UPDATE job_stage_instances SET scheduled_minutes = r_stage.duration_minutes, scheduled_start_at = (SELECT MIN((time_slot ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) time_slot), scheduled_end_at = stage_end_time, schedule_status = 'scheduled', updated_at = now() WHERE id = r_stage.stage_instance_id;
    updated_count := updated_count + 1;
  END LOOP;

  RAISE NOTICE '🔀 Starting Phase 2: Gap-Filling (120min cap)';
  FOR gap_candidate IN
    SELECT jsi.id as stage_instance_id, jsi.job_id, jsi.production_stage_id, jsi.scheduled_start_at, jsi.scheduled_end_at, jsi.scheduled_minutes, ps.name as stage_name, ps.allow_gap_filling
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.job_id = ANY(p_job_ids) AND jsi.schedule_status = 'scheduled' AND ps.allow_gap_filling = true AND jsi.scheduled_minutes IS NOT NULL AND jsi.scheduled_minutes <= 120 AND jsi.scheduled_start_at IS NOT NULL
    ORDER BY jsi.scheduled_start_at DESC
  LOOP
    original_start := gap_candidate.scheduled_start_at;
    SELECT * INTO best_gap FROM find_available_gaps(gap_candidate.production_stage_id, gap_candidate.scheduled_minutes, original_start, 21) ORDER BY gap_start ASC LIMIT 1;
    
    IF best_gap IS NOT NULL AND best_gap.days_earlier >= 1.0 THEN
      days_saved := best_gap.days_earlier;
      RAISE NOTICE '🔀 GAP-FILLING: Moving stage % from % to % (saves %.1f days)', gap_candidate.stage_name, original_start, best_gap.gap_start, days_saved;
      DELETE FROM stage_time_slots WHERE stage_instance_id = gap_candidate.stage_instance_id AND COALESCE(is_completed, false) = false;
      INSERT INTO stage_time_slots(production_stage_id, date, slot_start_time, slot_end_time, duration_minutes, job_id, job_table_name, stage_instance_id, is_completed)
      VALUES (gap_candidate.production_stage_id, best_gap.gap_start::date, best_gap.gap_start, best_gap.gap_start + make_interval(mins => gap_candidate.scheduled_minutes), gap_candidate.scheduled_minutes, gap_candidate.job_id, 'production_jobs', gap_candidate.stage_instance_id, false);
      UPDATE job_stage_instances SET scheduled_start_at = best_gap.gap_start, scheduled_end_at = best_gap.gap_start + make_interval(mins => gap_candidate.scheduled_minutes), updated_at = now() WHERE id = gap_candidate.stage_instance_id;
      INSERT INTO schedule_gap_fills(job_id, stage_instance_id, production_stage_id, original_scheduled_start, gap_filled_start, days_saved, minutes_saved, scheduler_run_type)
      VALUES (gap_candidate.job_id, gap_candidate.stage_instance_id, gap_candidate.production_stage_id, original_start, best_gap.gap_start, days_saved, (days_saved * 1440)::integer, 'append');
      gap_filled_count := gap_filled_count + 1;
    END IF;
  END LOOP;
  
  SELECT jsonb_agg(to_jsonb(v)) INTO validation_results FROM public.validate_job_scheduling_precedence() v WHERE job_id = ANY(p_job_ids);
  RAISE NOTICE 'Append scheduler completed: % slots written, % stages updated, % gap-filled', wrote_count, updated_count, gap_filled_count;
  RETURN QUERY SELECT wrote_count, updated_count, COALESCE(validation_results, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- RESTORE: scheduler_reschedule_all_parallel_aware (Oct 11 enhanced version)
-- SURGICAL ADDITIONS: p_division parameter + 3 WHERE clauses
-- ============================================================================
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(p_start_from timestamptz DEFAULT NULL, p_division TEXT DEFAULT NULL)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  base_time timestamptz; wrote_count integer := 0; updated_count integer := 0; validation_results jsonb := '[]'::jsonb; gap_filled_count integer := 0;
  r_job record; r_stage_group record; r_stage record; job_stage_barriers jsonb := '{}'::jsonb; resource_available_time timestamptz;
  stage_earliest_start timestamptz; placement_result record; slot_record jsonb; stage_end_time timestamptz; completed_barriers jsonb;
  cover_barrier_time timestamptz; text_barrier_time timestamptz; main_barrier_time timestamptz; barrier_key text;
  gap_candidate record; best_gap record; original_start timestamptz; days_saved numeric; earliest_possible_start timestamptz;
  predecessor_end timestamptz; gap_filled_end timestamptz; expired_count integer := 0; on_hold_count integer := 0;
BEGIN
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now()) + interval '1 day');
    RAISE NOTICE '🔄 Manual reschedule starting from TOMORROW: %', base_time;
  ELSE
    base_time := public.next_working_start(p_start_from);
    RAISE NOTICE '🔄 Scheduled reschedule starting from: %', base_time;
  END IF;

  -- SURGICAL DIVISION FILTER: Nuclear cleanup
  DELETE FROM stage_time_slots sts USING production_stages ps
  WHERE sts.production_stage_id = ps.id AND COALESCE(sts.is_completed, false) = false
    AND sts.slot_start_time >= base_time AND (p_division IS NULL OR ps.division = p_division);

  UPDATE job_stage_instances SET schedule_status = 'expired', scheduled_start_at = NULL, scheduled_end_at = NULL, scheduled_minutes = NULL, updated_at = now()
  WHERE schedule_status IN ('scheduled', 'auto_held') AND scheduled_start_at < now() - interval '7 days';

  UPDATE job_stage_instances SET schedule_status = 'unscheduled', scheduled_start_at = NULL, scheduled_end_at = NULL, scheduled_minutes = NULL, updated_at = now()
  WHERE status IN ('pending', 'on_hold') AND schedule_status != 'expired';

  PERFORM public.create_stage_availability_tracker();

  completed_barriers := (SELECT jsonb_object_agg(job_id::text, jsonb_build_object('main', COALESCE(main_end, base_time), 'cover', COALESCE(cover_end, base_time), 'text', COALESCE(text_end, base_time), 'both', COALESCE(both_end, base_time)))
    FROM (SELECT jsi.job_id, MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment = 'both') AS both_end, MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('cover', 'both')) AS cover_end,
      MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('text', 'both')) AS text_end, MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment = 'both') AS main_end
      FROM stage_time_slots sts JOIN job_stage_instances jsi ON jsi.id = sts.stage_instance_id WHERE sts.is_completed = true GROUP BY jsi.job_id) s);

  -- SURGICAL DIVISION FILTER: _stage_tails initialization
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT sts.production_stage_id, COALESCE(MAX(sts.slot_end_time), base_time)
  FROM stage_time_slots sts JOIN production_stages ps ON ps.id = sts.production_stage_id
  WHERE COALESCE(sts.is_completed, false) = true AND (p_division IS NULL OR ps.division = p_division)
  GROUP BY sts.production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  INSERT INTO _stage_tails(stage_id, next_available_time) SELECT DISTINCT jsi.production_stage_id, base_time FROM job_stage_instances jsi ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE '📋 Phase 1: FIFO Scheduling starting...';
  
  -- SURGICAL DIVISION FILTER: Job selection with DTP/PROOF exclusions
  FOR r_job IN
    SELECT pj.id as job_id, pj.wo_no, pj.proof_approved_at, pj.category_id
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL AND (p_division IS NULL OR pj.division = p_division)
      AND EXISTS (SELECT 1 FROM job_stage_instances jsi JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.job_id = pj.id AND jsi.status IN ('pending', 'active', 'on_hold')
          AND LOWER(COALESCE(ps.name, '')) NOT LIKE '%dtp%' AND LOWER(COALESCE(ps.name, '')) NOT LIKE '%proof%')
    ORDER BY pj.proof_approved_at ASC
  LOOP
    job_stage_barriers := COALESCE(completed_barriers -> r_job.job_id::text, jsonb_build_object('main', GREATEST(base_time, r_job.proof_approved_at), 'cover', GREATEST(base_time, r_job.proof_approved_at), 'text', GREATEST(base_time, r_job.proof_approved_at), 'both', GREATEST(base_time, r_job.proof_approved_at)));
    
    FOR r_stage_group IN SELECT stage_order, array_agg(jsi.id) as stage_instance_ids FROM job_stage_instances jsi WHERE jsi.job_id = r_job.job_id AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold') GROUP BY stage_order ORDER BY stage_order ASC LOOP
      FOR r_stage IN SELECT jsi.id as stage_instance_id, jsi.production_stage_id, jsi.stage_order, jsi.part_assignment, jsi.status, public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes, jsi.remaining_minutes, jsi.completion_percentage) as duration_minutes, ps.name as stage_name
        FROM job_stage_instances jsi JOIN production_stages ps ON ps.id = jsi.production_stage_id WHERE jsi.id = ANY(r_stage_group.stage_instance_ids) ORDER BY jsi.id
      LOOP
        IF r_stage.duration_minutes IS NULL OR r_stage.duration_minutes <= 0 THEN
          RAISE WARNING '⚠️ INVALID DURATION for job % (WO: %), stage %: duration=% mins. Skipping.', r_job.job_id, r_job.wo_no, r_stage.stage_name, r_stage.duration_minutes; CONTINUE;
        END IF;
        
        IF r_stage.part_assignment = 'both' THEN
          cover_barrier_time := COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          text_barrier_time := COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          main_barrier_time := COALESCE((job_stage_barriers->>'main')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          stage_earliest_start := GREATEST(cover_barrier_time, text_barrier_time, main_barrier_time); barrier_key := 'both';
        ELSE
          barrier_key := COALESCE(r_stage.part_assignment, 'main');
          IF NOT job_stage_barriers ? barrier_key THEN job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(GREATEST(base_time, r_job.proof_approved_at))); END IF;
          stage_earliest_start := (job_stage_barriers ->> barrier_key)::timestamptz;
        END IF;

        SELECT next_available_time INTO resource_available_time FROM _stage_tails WHERE stage_id = r_stage.production_stage_id FOR UPDATE;
        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end FROM job_stage_instances jsi2
        WHERE jsi2.job_id = r_job.job_id AND jsi2.stage_order < r_stage.stage_order AND jsi2.scheduled_end_at IS NOT NULL;

        IF predecessor_end IS NOT NULL AND predecessor_end > stage_earliest_start THEN
          RAISE NOTICE '🔒 Job % (WO: %) stage % (order %): waiting for predecessor to finish. Barrier: %, Predecessor end: %', r_job.job_id, r_job.wo_no, r_stage.stage_name, r_stage.stage_order, stage_earliest_start, predecessor_end;
          stage_earliest_start := predecessor_end;
        END IF;

        SELECT * INTO placement_result FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes, 60);
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE WARNING '⚠️ FAILED to schedule stage % for job %, skipping', r_stage.stage_name, r_job.job_id; CONTINUE;
        END IF;

        FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created) LOOP
          INSERT INTO stage_time_slots(production_stage_id, date, slot_start_time, slot_end_time, duration_minutes, job_id, job_table_name, stage_instance_id, is_completed)
          VALUES (r_stage.production_stage_id, (slot_record ->> 'date')::date, (slot_record ->> 'start_time')::timestamptz, (slot_record ->> 'end_time')::timestamptz, (slot_record ->> 'duration_minutes')::integer, r_job.job_id, 'production_jobs', r_stage.stage_instance_id, false);
          wrote_count := wrote_count + 1;
        END LOOP;

        SELECT MAX((time_slot ->> 'end_time')::timestamptz) INTO stage_end_time FROM jsonb_array_elements(placement_result.slots_created) time_slot;
        UPDATE _stage_tails SET next_available_time = stage_end_time WHERE stage_id = r_stage.production_stage_id;
        UPDATE job_stage_instances SET scheduled_minutes = r_stage.duration_minutes, scheduled_start_at = (SELECT MIN((time_slot ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) time_slot), scheduled_end_at = stage_end_time, schedule_status = 'scheduled', updated_at = now() WHERE id = r_stage.stage_instance_id;
        updated_count := updated_count + 1;
        job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(stage_end_time));
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ Phase 1 complete: % slots written, % stages scheduled', wrote_count, updated_count;

  -- PHASE 2: ENHANCED GAP-FILLING (Oct 11 version)
  RAISE NOTICE '🔀 Phase 2: Gap-Filling (searching forward from predecessor completion)';
  FOR gap_candidate IN
    SELECT jsi.id as stage_instance_id, jsi.job_id, jsi.production_stage_id, jsi.scheduled_start_at, jsi.scheduled_end_at, jsi.scheduled_minutes, jsi.stage_order, ps.name as stage_name, ps.allow_gap_filling, pj.wo_no,
      COALESCE((SELECT MAX(jsi2.scheduled_end_at) FROM job_stage_instances jsi2 WHERE jsi2.job_id = jsi.job_id AND jsi2.stage_order < jsi.stage_order AND jsi2.scheduled_end_at IS NOT NULL), base_time) as earliest_possible_start
    FROM job_stage_instances jsi JOIN production_stages ps ON ps.id = jsi.production_stage_id JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.schedule_status = 'scheduled' AND ps.allow_gap_filling = true AND jsi.scheduled_minutes IS NOT NULL AND jsi.scheduled_minutes <= 120 AND jsi.scheduled_start_at IS NOT NULL
    ORDER BY jsi.scheduled_start_at DESC
  LOOP
    original_start := gap_candidate.scheduled_start_at; earliest_possible_start := gap_candidate.earliest_possible_start;
    SELECT * INTO best_gap FROM find_available_gaps(gap_candidate.production_stage_id, gap_candidate.scheduled_minutes, original_start, 90, earliest_possible_start) WHERE gap_start >= earliest_possible_start ORDER BY gap_start ASC LIMIT 1;
    
    IF best_gap IS NOT NULL THEN
      days_saved := EXTRACT(EPOCH FROM (original_start - best_gap.gap_start)) / 86400.0;
      IF best_gap.gap_start >= earliest_possible_start AND best_gap.gap_start < original_start THEN
        RAISE NOTICE '🔀 GAP-FILLING: Moving stage % (WO: %, order %) from % to % (saves %.2f days)', gap_candidate.stage_name, gap_candidate.wo_no, gap_candidate.stage_order, original_start, best_gap.gap_start, days_saved;
        DELETE FROM stage_time_slots WHERE stage_instance_id = gap_candidate.stage_instance_id AND COALESCE(is_completed, false) = false;
        SELECT * INTO placement_result FROM public.place_duration_sql(best_gap.gap_start, gap_candidate.scheduled_minutes, 60);
        
        IF placement_result.placement_success THEN
          FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created) LOOP
            INSERT INTO stage_time_slots(production_stage_id, date, slot_start_time, slot_end_time, duration_minutes, job_id, job_table_name, stage_instance_id, is_completed)
            VALUES (gap_candidate.production_stage_id, (slot_record ->> 'date')::date, (slot_record ->> 'start_time')::timestamptz, (slot_record ->> 'end_time')::timestamptz, (slot_record ->> 'duration_minutes')::integer, gap_candidate.job_id, 'production_jobs', gap_candidate.stage_instance_id, false);
          END LOOP;
          SELECT MAX((slot ->> 'end_time')::timestamptz) INTO gap_filled_end FROM jsonb_array_elements(placement_result.slots_created) slot;
          UPDATE job_stage_instances SET scheduled_start_at = (SELECT MIN((slot ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) slot), scheduled_end_at = gap_filled_end, updated_at = now() WHERE id = gap_candidate.stage_instance_id;
          INSERT INTO schedule_gap_fills(job_id, stage_instance_id, production_stage_id, original_scheduled_start, gap_filled_start, days_saved, minutes_saved, scheduler_run_type)
          VALUES (gap_candidate.job_id, gap_candidate.stage_instance_id, gap_candidate.production_stage_id, original_start, best_gap.gap_start, days_saved, (days_saved * 1440)::integer, 'reschedule_all');
          gap_filled_count := gap_filled_count + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Phase 2 complete: % stages gap-filled', gap_filled_count;
  RETURN QUERY SELECT wrote_count, updated_count, validation_results;
END;
$$;

-- ============================================================================
-- NEW: simple_scheduler_wrapper matching edge function parameters
-- ============================================================================
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_commit BOOLEAN DEFAULT TRUE, p_proposed BOOLEAN DEFAULT TRUE, p_only_if_unset BOOLEAN DEFAULT TRUE,
  p_nuclear BOOLEAN DEFAULT FALSE, p_start_from TIMESTAMPTZ DEFAULT NULL, p_only_job_ids UUID[] DEFAULT NULL, p_division TEXT DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '180s'
AS $$
DECLARE result record; response jsonb;
BEGIN
  IF p_only_job_ids IS NOT NULL AND array_length(p_only_job_ids, 1) > 0 THEN
    SELECT * INTO result FROM public.scheduler_append_jobs(p_only_job_ids, p_only_if_unset, p_division);
    response := jsonb_build_object('success', true, 'wrote_slots', result.wrote_slots, 'updated_jsi', result.updated_jsi, 'violations', result.violations);
  ELSE
    SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware(COALESCE(p_start_from, now()), p_division);
    response := jsonb_build_object('success', true, 'wrote_slots', result.wrote_slots, 'updated_jsi', result.updated_jsi, 'violations', result.violations);
  END IF;
  RETURN response;
END;
$$;

GRANT EXECUTE ON FUNCTION public.scheduler_append_jobs(UUID[], BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.scheduler_reschedule_all_parallel_aware(TIMESTAMPTZ, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.simple_scheduler_wrapper(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID[], TEXT) TO service_role;