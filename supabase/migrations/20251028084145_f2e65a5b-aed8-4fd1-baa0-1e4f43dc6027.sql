-- Fix broken column references in scheduler functions
-- Bug: Oct 27 migrations incorrectly changed jsi_minutes calls to use non-existent column manual_duration_override_minutes
-- This restores correct column references: scheduled_minutes, estimated_duration_minutes, remaining_minutes, completion_percentage

-- Drop functions with full signatures to avoid ambiguity
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_by_division(TEXT, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(UUID[], BOOLEAN, TEXT) CASCADE;

-- Recreate scheduler_reschedule_all_by_division with correct jsi_minutes calls
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_by_division(
  p_division text DEFAULT NULL,
  p_start_from timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
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
  max_barrier_time timestamptz;
  completed_barriers jsonb;
  barrier_key text;
  cover_barrier_time timestamptz;
  text_barrier_time timestamptz;
  main_barrier_time timestamptz;
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  days_saved numeric;
  hours_saved numeric;
  earliest_possible_start timestamptz;
  new_start timestamptz;
  new_end timestamptz;
  v_min_future_threshold timestamptz;
  v_lookback_days integer;
  v_days_back_to_prev numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(1, 42);
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;
  RAISE NOTICE 'Starting DIVISION-AWARE scheduler (division: %) from: %', COALESCE(p_division, 'ALL'), base_time;
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false AND (p_division IS NULL OR production_stage_id IN (SELECT id FROM production_stages WHERE division = p_division));
  UPDATE job_stage_instances SET scheduled_start_at = NULL, scheduled_end_at = NULL, scheduled_minutes = NULL, schedule_status = NULL, updated_at = now() WHERE COALESCE(status, '') NOT IN ('completed', 'active') AND (p_division IS NULL OR production_stage_id IN (SELECT id FROM production_stages WHERE division = p_division));
  PERFORM public.create_stage_availability_tracker();
  INSERT INTO _stage_tails(stage_id, next_available_time) SELECT production_stage_id, GREATEST(COALESCE(MAX(slot_end_time), base_time), base_time) FROM stage_time_slots WHERE COALESCE(is_completed, false) = true GROUP BY production_stage_id ON CONFLICT (stage_id) DO UPDATE SET next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);
  INSERT INTO _stage_tails(stage_id, next_available_time) SELECT DISTINCT jsi.production_stage_id, base_time FROM job_stage_instances jsi WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active') ON CONFLICT (stage_id) DO NOTHING;
  FOR r_job IN SELECT pj.id as job_id, pj.proof_approved_at, pj.wo_no, COUNT(jsi.id) as total_stages FROM production_jobs pj JOIN job_stage_instances jsi ON jsi.job_id = pj.id WHERE pj.proof_approved_at IS NOT NULL AND COALESCE(jsi.status, '') NOT IN ('completed', 'active') AND (p_division IS NULL OR jsi.production_stage_id IN (SELECT id FROM production_stages WHERE division = p_division)) GROUP BY pj.id, pj.proof_approved_at, pj.wo_no ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    SELECT jsonb_object_agg(COALESCE(jsi.part_assignment, 'main'), COALESCE(jsi.scheduled_end_at, jsi.completed_at, GREATEST(base_time, r_job.proof_approved_at))) INTO completed_barriers FROM job_stage_instances jsi WHERE jsi.job_id = r_job.job_id AND jsi.status = 'completed' AND (jsi.scheduled_end_at IS NOT NULL OR jsi.completed_at IS NOT NULL);
    job_stage_barriers := COALESCE(completed_barriers, '{}'::jsonb) || jsonb_build_object('main', GREATEST(base_time, r_job.proof_approved_at)) || jsonb_build_object('cover', COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at))) || jsonb_build_object('text', COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at)));
    FOR r_stage_group IN SELECT stage_order, array_agg(jsi.id) as stage_instance_ids, array_agg(DISTINCT jsi.part_assignment) FILTER (WHERE jsi.part_assignment IS NOT NULL) as parts_in_group, COUNT(*) as stages_in_group FROM job_stage_instances jsi WHERE jsi.job_id = r_job.job_id AND COALESCE(jsi.status, '') NOT IN ('completed', 'active') GROUP BY stage_order ORDER BY stage_order ASC
    LOOP
      FOR r_stage IN SELECT jsi.id as stage_instance_id, jsi.production_stage_id, jsi.stage_order, jsi.part_assignment, jsi.dependency_group, jsi.status, public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes, jsi.remaining_minutes, jsi.completion_percentage) as duration_minutes, ps.name as stage_name FROM job_stage_instances jsi JOIN production_stages ps ON ps.id = jsi.production_stage_id WHERE jsi.id = ANY(r_stage_group.stage_instance_ids) ORDER BY jsi.id
      LOOP
        IF r_stage.duration_minutes IS NULL OR r_stage.duration_minutes <= 0 THEN
          validation_results := validation_results || jsonb_build_array(jsonb_build_object('job_id', r_job.job_id, 'wo_no', r_job.wo_no, 'stage_name', r_stage.stage_name, 'issue', 'invalid_duration', 'duration_minutes', r_stage.duration_minutes, 'message', format('Stage "%s" has invalid duration (%s mins). Run sync_stage_timing_from_subtasks to fix.', r_stage.stage_name, r_stage.duration_minutes)));
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
        SELECT next_available_time INTO resource_available_time FROM _stage_tails WHERE stage_id = r_stage.production_stage_id FOR UPDATE;
        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);
        SELECT * INTO placement_result FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes, 60);
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE EXCEPTION 'FAILED to schedule stage % for job %', r_stage.stage_name, r_job.job_id;
        END IF;
        FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created) LOOP
          INSERT INTO stage_time_slots(production_stage_id, date, slot_start_time, slot_end_time, duration_minutes, job_id, job_table_name, stage_instance_id, is_completed) VALUES (r_stage.production_stage_id, (slot_record ->> 'date')::date, (slot_record ->> 'start_time')::timestamptz, (slot_record ->> 'end_time')::timestamptz, (slot_record ->> 'duration_minutes')::integer, r_job.job_id, 'production_jobs', r_stage.stage_instance_id, false);
          wrote_count := wrote_count + 1;
        END LOOP;
        SELECT MAX((time_slot ->> 'end_time')::timestamptz) INTO stage_end_time FROM jsonb_array_elements(placement_result.slots_created) time_slot;
        UPDATE _stage_tails SET next_available_time = stage_end_time WHERE stage_id = r_stage.production_stage_id;
        UPDATE job_stage_instances SET scheduled_minutes = r_stage.duration_minutes, scheduled_start_at = (SELECT MIN((time_slot ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) time_slot), scheduled_end_at = stage_end_time, schedule_status = 'scheduled', updated_at = now() WHERE id = r_stage.stage_instance_id;
        updated_count := updated_count + 1;
        IF r_stage.part_assignment = 'both' THEN
          job_stage_barriers := job_stage_barriers || jsonb_build_object('main', stage_end_time) || jsonb_build_object('cover', stage_end_time) || jsonb_build_object('text', stage_end_time) || jsonb_build_object('both', stage_end_time);
        ELSE
          job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(stage_end_time));
        END IF;
      END LOOP;
      SELECT GREATEST((job_stage_barriers ->> 'main')::timestamptz, COALESCE((job_stage_barriers ->> 'cover')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz), COALESCE((job_stage_barriers ->> 'text')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz), COALESCE((job_stage_barriers ->> 'both')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz)) INTO max_barrier_time;
      job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY['main'], to_jsonb(max_barrier_time));
    END LOOP;
  END LOOP;
  v_min_future_threshold := now();
  FOR gap_candidate IN SELECT jsi.id as stage_instance_id, jsi.job_id, jsi.production_stage_id, jsi.scheduled_start_at, jsi.scheduled_end_at, jsi.scheduled_minutes, jsi.stage_order, ps.name as stage_name, ps.allow_gap_filling FROM job_stage_instances jsi JOIN production_stages ps ON ps.id = jsi.production_stage_id WHERE jsi.schedule_status = 'scheduled' AND ps.allow_gap_filling = true AND jsi.scheduled_minutes IS NOT NULL AND jsi.scheduled_minutes <= 120 AND jsi.scheduled_start_at >= v_min_future_threshold AND (p_division IS NULL OR ps.division = p_division) ORDER BY jsi.stage_order ASC, jsi.scheduled_start_at DESC
  LOOP
    original_start := gap_candidate.scheduled_start_at;
    SELECT COALESCE(MAX(jsi2.scheduled_end_at), now()) INTO earliest_possible_start FROM job_stage_instances jsi2 WHERE jsi2.job_id = gap_candidate.job_id AND jsi2.stage_order < gap_candidate.stage_order AND jsi2.scheduled_end_at IS NOT NULL;
    earliest_possible_start := GREATEST(earliest_possible_start, now());
    v_days_back_to_prev := EXTRACT(epoch FROM (original_start - earliest_possible_start)) / 86400.0;
    v_lookback_days := LEAST(90, GREATEST(7, FLOOR(v_days_back_to_prev)))::integer;
    SELECT g.* INTO best_gap FROM find_available_gaps(gap_candidate.production_stage_id, gap_candidate.scheduled_minutes, original_start, v_lookback_days, earliest_possible_start) g ORDER BY g.gap_start ASC LIMIT 1;
    IF best_gap IS NOT NULL THEN
      new_start := best_gap.gap_start;
      new_end := best_gap.gap_end;
      days_saved := EXTRACT(epoch FROM (original_start - new_start)) / 86400.0;
      hours_saved := days_saved * 24;
    END IF;
    IF best_gap IS NOT NULL AND days_saved >= 0.25 THEN
      DELETE FROM stage_time_slots WHERE stage_instance_id = gap_candidate.stage_instance_id AND COALESCE(is_completed, false) = false;
      INSERT INTO stage_time_slots(production_stage_id, date, slot_start_time, slot_end_time, duration_minutes, job_id, job_table_name, stage_instance_id, is_completed) VALUES (gap_candidate.production_stage_id, new_start::date, new_start, new_end, gap_candidate.scheduled_minutes, gap_candidate.job_id, 'production_jobs', gap_candidate.stage_instance_id, false);
      UPDATE job_stage_instances SET scheduled_start_at = new_start, scheduled_end_at = new_end, updated_at = now() WHERE id = gap_candidate.stage_instance_id;
      INSERT INTO schedule_gap_fills(job_id, stage_instance_id, production_stage_id, original_scheduled_start, gap_filled_start, days_saved, minutes_saved, scheduler_run_type) VALUES (gap_candidate.job_id, gap_candidate.stage_instance_id, gap_candidate.production_stage_id, original_start, new_start, days_saved, (hours_saved * 60)::integer, 'reschedule_all_division');
      gap_filled_count := gap_filled_count + 1;
    END IF;
  END LOOP;
  SELECT jsonb_agg(to_jsonb(v)) INTO validation_results FROM public.validate_job_scheduling_precedence() v;
  RETURN jsonb_build_object('wrote_slots', wrote_count, 'updated_jsi', updated_count, 'violations', COALESCE(validation_results, '[]'::jsonb), 'gap_filled', gap_filled_count, 'division', p_division);
END;
$$;

-- Recreate scheduler_append_jobs with correct jsi_minutes calls
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids UUID[],
  p_only_if_unset BOOLEAN DEFAULT true,
  p_division TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_start TIMESTAMPTZ;
  v_current_time TIMESTAMPTZ;
  v_slots_written INT := 0;
  v_jobs_touched INT := 0;
  v_factory_tz TEXT := 'Africa/Johannesburg';
  r_job RECORD;
  r_stage_group RECORD;
  r_stage RECORD;
  job_stage_barriers jsonb := '{}'::jsonb;
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  barrier_key text;
  cover_barrier_time timestamptz;
  text_barrier_time timestamptz;
  main_barrier_time timestamptz;
  completed_barriers jsonb;
BEGIN
  v_current_time := NOW() AT TIME ZONE v_factory_tz;
  v_base_start := public.next_working_start(v_current_time);
  PERFORM public.create_stage_availability_tracker();
  INSERT INTO _stage_tails(stage_id, next_available_time) SELECT production_stage_id, GREATEST(COALESCE(MAX(slot_end_time), v_base_start), v_base_start) FROM stage_time_slots WHERE COALESCE(is_completed, false) = true GROUP BY production_stage_id ON CONFLICT (stage_id) DO UPDATE SET next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);
  FOR r_job IN SELECT pj.id as job_id, pj.wo_no, pj.proof_approved_at, pj.category_id, pj.division FROM production_jobs pj WHERE pj.id = ANY(p_job_ids) AND pj.proof_approved_at IS NOT NULL AND (p_division IS NULL OR pj.division = p_division) AND EXISTS (SELECT 1 FROM job_stage_instances jsi2 JOIN production_stages ps2 ON ps2.id = jsi2.production_stage_id WHERE jsi2.job_id = pj.id AND jsi2.status IN ('pending', 'active', 'on_hold') AND LOWER(ps2.name) NOT LIKE '%dtp%' AND LOWER(ps2.name) NOT LIKE '%proof%' AND LOWER(ps2.name) NOT LIKE '%batch%allocation%') ORDER BY pj.proof_approved_at ASC
  LOOP
    v_jobs_touched := v_jobs_touched + 1;
    SELECT jsonb_object_agg(COALESCE(jsi.part_assignment, 'main'), COALESCE(jsi.scheduled_end_at, jsi.completed_at, GREATEST(v_base_start, r_job.proof_approved_at))) INTO completed_barriers FROM job_stage_instances jsi WHERE jsi.job_id = r_job.job_id AND jsi.status = 'completed' AND (jsi.scheduled_end_at IS NOT NULL OR jsi.completed_at IS NOT NULL);
    job_stage_barriers := COALESCE(completed_barriers, '{}'::jsonb) || jsonb_build_object('main', GREATEST(v_base_start, r_job.proof_approved_at)) || jsonb_build_object('cover', COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(v_base_start, r_job.proof_approved_at))) || jsonb_build_object('text', COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(v_base_start, r_job.proof_approved_at)));
    FOR r_stage_group IN SELECT jsi.stage_order, array_agg(jsi.id ORDER BY jsi.id) as stage_instance_ids FROM job_stage_instances jsi JOIN production_stages ps ON ps.id = jsi.production_stage_id WHERE jsi.job_id = r_job.job_id AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold') AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL) AND LOWER(ps.name) NOT LIKE '%dtp%' AND LOWER(ps.name) NOT LIKE '%proof%' AND LOWER(ps.name) NOT LIKE '%batch%allocation%' GROUP BY jsi.stage_order ORDER BY jsi.stage_order ASC
    LOOP
      FOR r_stage IN SELECT jsi.id as stage_instance_id, jsi.production_stage_id, jsi.stage_order, jsi.part_assignment, jsi.status, public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes, jsi.remaining_minutes, jsi.completion_percentage) as duration_minutes, ps.name as stage_name FROM job_stage_instances jsi JOIN production_stages ps ON ps.id = jsi.production_stage_id WHERE jsi.id = ANY(r_stage_group.stage_instance_ids) AND LOWER(ps.name) NOT LIKE '%dtp%' AND LOWER(ps.name) NOT LIKE '%proof%' AND LOWER(ps.name) NOT LIKE '%batch%allocation%' ORDER BY jsi.id
      LOOP
        IF r_stage.part_assignment = 'both' THEN
          cover_barrier_time := COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(v_base_start, r_job.proof_approved_at));
          text_barrier_time := COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(v_base_start, r_job.proof_approved_at));
          main_barrier_time := COALESCE((job_stage_barriers->>'main')::timestamptz, GREATEST(v_base_start, r_job.proof_approved_at));
          stage_earliest_start := GREATEST(cover_barrier_time, text_barrier_time, main_barrier_time);
          barrier_key := 'both';
        ELSE
          barrier_key := COALESCE(r_stage.part_assignment, 'main');
          IF NOT job_stage_barriers ? barrier_key THEN
            job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(GREATEST(v_base_start, r_job.proof_approved_at)));
          END IF;
          stage_earliest_start := (job_stage_barriers ->> barrier_key)::timestamptz;
        END IF;
        SELECT next_available_time INTO resource_available_time FROM _stage_tails WHERE stage_id = r_stage.production_stage_id FOR UPDATE;
        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);
        SELECT * INTO placement_result FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes, 60);
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE EXCEPTION 'FAILED to schedule stage % for job %', r_stage.stage_name, r_job.job_id;
        END IF;
        FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created) LOOP
          INSERT INTO stage_time_slots(production_stage_id, date, slot_start_time, slot_end_time, duration_minutes, job_id, job_table_name, stage_instance_id, is_completed) VALUES (r_stage.production_stage_id, (slot_record ->> 'date')::date, (slot_record ->> 'start_time')::timestamptz, (slot_record ->> 'end_time')::timestamptz, (slot_record ->> 'duration_minutes')::integer, r_job.job_id, 'production_jobs', r_stage.stage_instance_id, false);
          v_slots_written := v_slots_written + 1;
        END LOOP;
        SELECT MAX((time_slot ->> 'end_time')::timestamptz) INTO stage_end_time FROM jsonb_array_elements(placement_result.slots_created) time_slot;
        UPDATE _stage_tails SET next_available_time = stage_end_time WHERE stage_id = r_stage.production_stage_id;
        UPDATE job_stage_instances SET scheduled_minutes = r_stage.duration_minutes, scheduled_start_at = (SELECT MIN((time_slot ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) time_slot), scheduled_end_at = stage_end_time, schedule_status = 'scheduled', updated_at = now() WHERE id = r_stage.stage_instance_id;
        IF r_stage.part_assignment = 'both' THEN
          job_stage_barriers := job_stage_barriers || jsonb_build_object('main', stage_end_time) || jsonb_build_object('cover', stage_end_time) || jsonb_build_object('text', stage_end_time) || jsonb_build_object('both', stage_end_time);
        ELSE
          job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(stage_end_time));
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'wrote_slots', v_slots_written, 'updated_jsi', v_jobs_touched);
END;
$$;

-- Drop the redundant trigger
DROP TRIGGER IF EXISTS trg_schedule_on_proof_approval ON public.job_stage_instances;
DROP FUNCTION IF EXISTS public.trg_fn_schedule_on_proof_approval();