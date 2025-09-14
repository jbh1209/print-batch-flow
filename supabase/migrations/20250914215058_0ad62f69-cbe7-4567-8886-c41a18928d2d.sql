-- Emergency precedence enforcement and repair utilities
-- 1) Enforce that no stage can be scheduled before its predecessors are finished

-- Helper already exists: public.get_actual_stage_end_time(stage_instance_id)
-- We'll add a trigger function on stage_time_slots that checks the immediate predecessor

CREATE OR REPLACE FUNCTION public.enforce_stage_precedence_on_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cur_jsi RECORD;
  pred_jsi RECORD;
  new_start timestamptz;
  pred_end timestamptz;
BEGIN
  -- If NEW.stage_instance_id is null, nothing we can check
  IF NEW.stage_instance_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO cur_jsi
  FROM public.job_stage_instances
  WHERE id = NEW.stage_instance_id;

  -- If stage instance not found, allow (avoid hard failure)
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Only enforce for production_jobs workflow (same behavior otherwise but safer to scope)
  IF cur_jsi.job_table_name IS NULL OR cur_jsi.job_table_name = '' THEN
    RETURN NEW;
  END IF;

  new_start := NEW.slot_start_time;

  -- Identify the immediate predecessor by stage_order
  SELECT jsi_prev.* INTO pred_jsi
  FROM public.job_stage_instances jsi_prev
  WHERE jsi_prev.job_id = cur_jsi.job_id
    AND jsi_prev.job_table_name = cur_jsi.job_table_name
    AND jsi_prev.stage_order < cur_jsi.stage_order
  ORDER BY jsi_prev.stage_order DESC
  LIMIT 1;

  IF pred_jsi IS NULL THEN
    -- No predecessor, nothing to enforce
    RETURN NEW;
  END IF;

  -- Determine predecessor end time (scheduled_end, completed_at, or estimated from start + est)
  SELECT public.get_actual_stage_end_time(pred_jsi.id) INTO pred_end;

  -- If predecessor ends after the new slot start time, block
  IF pred_end IS NOT NULL AND pred_end > new_start THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = format(
        'Precedence violation: cannot start stage_order % at % before predecessor (order %) ends at % [job: %]',
        cur_jsi.stage_order, new_start, pred_jsi.stage_order, pred_end, cur_jsi.job_id
      ),
      DETAIL = format('stage_instance_id=%s predecessor_id=%s', cur_jsi.id, pred_jsi.id),
      HINT = 'Ensure earlier stages finish before scheduling later stages.';
  END IF;

  RETURN NEW;
END;
$$;

-- Create/replace trigger on stage_time_slots
DROP TRIGGER IF EXISTS trg_enforce_stage_precedence ON public.stage_time_slots;
CREATE TRIGGER trg_enforce_stage_precedence
BEFORE INSERT OR UPDATE ON public.stage_time_slots
FOR EACH ROW EXECUTE FUNCTION public.enforce_stage_precedence_on_slot();


-- 2) Detection function to surface existing precedence violations
CREATE OR REPLACE FUNCTION public.find_precedence_violations()
RETURNS TABLE(
  job_id uuid,
  stage_instance_id uuid,
  stage_order integer,
  slot_start_time timestamptz,
  predecessor_stage_instance_id uuid,
  predecessor_stage_order integer,
  predecessor_end_time timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sts.job_id,
    sts.stage_instance_id,
    cur.stage_order,
    sts.slot_start_time,
    pred.id as predecessor_stage_instance_id,
    pred.stage_order as predecessor_stage_order,
    public.get_actual_stage_end_time(pred.id) as predecessor_end_time
  FROM public.stage_time_slots sts
  JOIN public.job_stage_instances cur ON cur.id = sts.stage_instance_id
  JOIN LATERAL (
    SELECT jsi_prev.*
    FROM public.job_stage_instances jsi_prev
    WHERE jsi_prev.job_id = cur.job_id
      AND jsi_prev.job_table_name = cur.job_table_name
      AND jsi_prev.stage_order < cur.stage_order
    ORDER BY jsi_prev.stage_order DESC
    LIMIT 1
  ) pred ON true
  WHERE public.get_actual_stage_end_time(pred.id) > sts.slot_start_time;
END;
$$;


-- 3) Repair function to clear violating slots and reset their instances to unscheduled
CREATE OR REPLACE FUNCTION public.repair_precedence_violations()
RETURNS TABLE(deleted_slots integer, reset_instances integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT stage_instance_id) INTO v_ids
  FROM public.find_precedence_violations();

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  DELETE FROM public.stage_time_slots WHERE stage_instance_id = ANY(v_ids);
  GET DIAGNOSTICS deleted_slots = ROW_COUNT;

  UPDATE public.job_stage_instances
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = 'unscheduled',
    updated_at = now()
  WHERE id = ANY(v_ids);
  GET DIAGNOSTICS reset_instances = ROW_COUNT;

  RETURN QUERY SELECT deleted_slots, reset_instances;
END;
$$;

-- 4) Performance safety: helpful index for predecessor lookups
CREATE INDEX IF NOT EXISTS idx_jsi_job_stage_order
  ON public.job_stage_instances (job_id, job_table_name, stage_order);
