-- Division-aware scheduler: Copy-only approach
-- Creates new division-scoped functions without modifying existing working versions

-- ===================================================================
-- 1. CREATE NEW DIVISION-AWARE FULL RESCHEDULE FUNCTION (COPY)
-- ===================================================================
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_by_division(
  p_division text DEFAULT NULL,
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  
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
BEGIN
  PERFORM pg_advisory_xact_lock(1, 42);

  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting DIVISION-AWARE scheduler from: % for division: %', base_time, COALESCE(p_division, 'ALL');

  -- DIVISION-SCOPED DELETE
  DELETE FROM stage_time_slots sts
  USING production_jobs pj
  WHERE sts.job_id = pj.id 
    AND sts.job_table_name = 'production_jobs'
    AND COALESCE(sts.is_completed, false) = false
    AND (p_division IS NULL OR pj.division = p_division);

  -- DIVISION-SCOPED UPDATE
  UPDATE job_stage_instances jsi
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  FROM production_jobs pj
  WHERE jsi.job_id = pj.id
    AND jsi.job_table_name = 'production_jobs'
    AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
    AND (p_division IS NULL OR pj.division = p_division);

  PERFORM public.create_stage_availability_tracker();
  
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT production_stage_id, GREATEST(COALESCE(MAX(slot_end_time), base_time), base_time)
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  JOIN production_jobs pj ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
    AND (p_division IS NULL OR pj.division = p_division)
  ON CONFLICT (stage_id) DO NOTHING;

  -- DIVISION-SCOPED JOB LOOP
  FOR r_job IN
    SELECT pj.id as job_id, pj.proof_approved_at, pj.wo_no, COUNT(jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    WHERE pj.proof_approved_at IS NOT NULL
      AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      AND (p_division IS NULL OR pj.division = p_division)
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    SELECT jsonb_object_agg(
      COALESCE(jsi.part_assignment, 'main'),
      COALESCE(jsi.scheduled_end_at, jsi.completed_at, GREATEST(base_time, r_job.proof_approved_at))
    ) INTO completed_barriers
    FROM job_stage_instances jsi
    WHERE jsi.job_id = r_job.job_id AND jsi.status = 'completed' AND (jsi.scheduled_end_at IS NOT NULL OR jsi.completed_at IS NOT NULL);
    
    job_stage_barriers := COALESCE(completed_barriers, '{}'::jsonb);
    job_stage_barriers := job_stage_barriers 
      || jsonb_build_object('main', GREATEST(base_time, r_job.proof_approved_at))
      || jsonb_build_object('cover', COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at)))
      || jsonb_build_object('text', COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at)));
    
    FOR r_stage_group IN
      SELECT stage_order, array_agg(jsi.id) as stage_instance_ids, COUNT(*) as stages_in_group
      FROM job_stage_instances jsi
      WHERE jsi.job_id = r_job.job_id AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      GROUP BY stage_order ORDER BY stage_order ASC
    LOOP
      FOR r_stage IN
        SELECT jsi.id as stage_instance_id, jsi.production_stage_id, jsi.stage_order, jsi.part_assignment,
          public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes, jsi.remaining_minutes, jsi.completion_percentage) as duration_minutes,
          ps.name as stage_name
        FROM job_stage_instances jsi
        JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.id = ANY(r_stage_group.stage_instance_ids)
        ORDER BY jsi.id
      LOOP
        IF r_stage.duration_minutes IS NULL OR r_stage.duration_minutes <= 0 THEN CONTINUE; END IF;
        
        IF r_stage.part_assignment = 'both' THEN
          stage_earliest_start := GREATEST(
            COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at)),
            COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at)),
            COALESCE((job_stage_barriers->>'main')::timestamptz, GREATEST(base_time, r_job.proof_approved_at))
          );
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
          INSERT INTO stage_time_slots(production_stage_id, date, slot_start_time, slot_end_time, duration_minutes, job_id, job_table_name, stage_instance_id, is_completed)
          VALUES (r_stage.production_stage_id, (slot_record ->> 'date')::date, (slot_record ->> 'start_time')::timestamptz, (slot_record ->> 'end_time')::timestamptz, (slot_record ->> 'duration_minutes')::integer, r_job.job_id, 'production_jobs', r_stage.stage_instance_id, false);
          wrote_count := wrote_count + 1;
        END LOOP;

        SELECT MAX((time_slot ->> 'end_time')::timestamptz) INTO stage_end_time FROM jsonb_array_elements(placement_result.slots_created) time_slot;
        UPDATE _stage_tails SET next_available_time = stage_end_time WHERE stage_id = r_stage.production_stage_id;
        
        UPDATE job_stage_instances SET scheduled_minutes = r_stage.duration_minutes,
          scheduled_start_at = (SELECT MIN((time_slot ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) time_slot),
          scheduled_end_at = stage_end_time, schedule_status = 'scheduled', updated_at = now()
        WHERE id = r_stage.stage_instance_id;
        updated_count := updated_count + 1;

        IF r_stage.part_assignment = 'both' THEN
          job_stage_barriers := job_stage_barriers || jsonb_build_object('main', stage_end_time) || jsonb_build_object('cover', stage_end_time) || jsonb_build_object('text', stage_end_time) || jsonb_build_object('both', stage_end_time);
        ELSE
          job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(stage_end_time));
        END IF;
      END LOOP;
      
      SELECT GREATEST((job_stage_barriers ->> 'main')::timestamptz, COALESCE((job_stage_barriers ->> 'cover')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz),
        COALESCE((job_stage_barriers ->> 'text')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz), COALESCE((job_stage_barriers ->> 'both')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz))
      INTO max_barrier_time;
      job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY['main'], to_jsonb(max_barrier_time));
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('wrote_slots', wrote_count, 'updated_jsi', updated_count, 'division', p_division);
END;
$$;

-- Rebind triggers to division-aware versions
CREATE OR REPLACE FUNCTION public.notify_scheduler_on_proof_approval_div() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_fn_url text := 'https://kgizusgqexmlfcqfjopk.functions.supabase.co/scheduler-run'; v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXp1c2dxZXhtbGZjcWZqb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTQwNzAsImV4cCI6MjA2MDEzMDA3MH0.NA2wRme-L8Z15my7n8u-BCQtO4Nw2opfsX0KSLYcs-I'; v_body jsonb; v_req_id bigint; v_division text;
begin
  if tg_op = 'UPDATE' and NEW.proof_approved_at is not null and (OLD.proof_approved_at is null or NEW.proof_approved_at <> OLD.proof_approved_at) then
    SELECT pj.division INTO v_division FROM public.production_jobs pj WHERE pj.id = NEW.id LIMIT 1;
    v_body := jsonb_build_object('commit', true, 'proposed', false, 'onlyIfUnset', false, 'nuclear', false, 'onlyJobIds', jsonb_build_array(NEW.id), 'division', v_division);
    select net.http_post(url := v_fn_url, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_anon), body := v_body, timeout_milliseconds := 8000) into v_req_id;
    insert into public.scheduler_webhook_log(created_at, job_id, order_no, event, request_id, request_body, http_status, response_excerpt, http_error)
    values (now(), NEW.id, NEW.wo_no, 'proof_approved', v_req_id, v_body, 0, '', '');
  end if;
  return NEW;
end $$;

CREATE OR REPLACE FUNCTION public.trigger_simple_scheduler_div() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_division text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status ILIKE '%approved%' OR NEW.status ILIKE '%ready%' OR NEW.status ILIKE '%production%' OR NEW.status = 'Pre-Press') THEN
    SELECT pj.division INTO v_division FROM public.production_jobs pj WHERE pj.id = NEW.id LIMIT 1;
    PERFORM net.http_post(url := 'https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/simple-scheduler',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXp1c2dxZXhtbGZjcWZqb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTQwNzAsImV4cCI6MjA2MDEzMDA3MH0.NA2wRme-L8Z15my7n8u-BCQtO4Nw2opfsX0KSLYcs-I"}'::jsonb,
      body := jsonb_build_object('job_id', NEW.id, 'job_table_name', 'production_jobs', 'division', v_division));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_schedule_on_approval ON public.production_jobs;
CREATE TRIGGER trg_schedule_on_approval AFTER UPDATE OF proof_approved_at ON public.production_jobs FOR EACH ROW EXECUTE FUNCTION public.notify_scheduler_on_proof_approval_div();

DROP TRIGGER IF EXISTS trg_simple_scheduler ON public.production_jobs;
CREATE TRIGGER trg_simple_scheduler AFTER UPDATE OF status ON public.production_jobs FOR EACH ROW WHEN (NEW.status IS DISTINCT FROM OLD.status AND (NEW.status ILIKE '%approved%' OR NEW.status ILIKE '%ready%' OR NEW.status ILIKE '%production%' OR NEW.status = 'Pre-Press')) EXECUTE FUNCTION public.trigger_simple_scheduler_div();