-- Minimal surgical fix: ensure reschedule-all passes concrete job IDs and uses named args
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_start_from TIMESTAMPTZ DEFAULT NULL,
  p_division   TEXT DEFAULT NULL,
  p_nuclear    BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  wrote_slots INTEGER,
  updated_jsi INTEGER,
  violations  JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wrote       INTEGER := 0;
  v_updated     INTEGER := 0;
  v_violations  JSONB   := '[]'::jsonb;
  v_job_ids     uuid[]  := NULL;
BEGIN
  -- Optional nuclear cleanup (scoped by division and start time)
  IF p_nuclear THEN
    DELETE FROM public.stage_time_slots sts
    USING public.job_stage_instances jsi
    JOIN public.production_stages ps ON ps.id = jsi.production_stage_id
    WHERE sts.stage_instance_id = jsi.id
      AND COALESCE(sts.is_completed, false) = false
      AND (p_start_from IS NULL OR sts.slot_start_time >= p_start_from)
      AND (p_division IS NULL OR ps.division = p_division);
  END IF;

  -- Derive the set of job IDs to (re)schedule, scoped by division when provided
  SELECT array_agg(DISTINCT jsi.job_id)
    INTO v_job_ids
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON ps.id = jsi.production_stage_id
  WHERE (p_division IS NULL OR ps.division = p_division);

  -- If no jobs found, short-circuit with zeros
  IF v_job_ids IS NULL OR array_length(v_job_ids, 1) IS NULL THEN
    wrote_slots := 0;
    updated_jsi := 0;
    violations  := '[]'::jsonb;
    RETURN NEXT;
    RETURN;  -- end function
  END IF;

  -- Delegate to append-only scheduler for the derived job list (full reflow)
  SELECT r.wrote_slots, r.updated_jsi, COALESCE(r.violations, '[]'::jsonb)
    INTO v_wrote, v_updated, v_violations
  FROM public.scheduler_append_jobs(
    p_division       => p_division,
    p_job_ids        => v_job_ids,
    p_only_if_unset  => FALSE
  ) AS r;

  wrote_slots := COALESCE(v_wrote, 0);
  updated_jsi := COALESCE(v_updated, 0);
  violations  := COALESCE(v_violations, '[]'::jsonb);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.scheduler_reschedule_all_parallel_aware(TIMESTAMPTZ, TEXT, BOOLEAN) TO service_role;