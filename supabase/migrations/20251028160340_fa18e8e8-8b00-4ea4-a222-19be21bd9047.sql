-- Fix invalid column reference in nuclear cleanup
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
BEGIN
  -- Optional nuclear cleanup (scoped by division and start time)
  IF p_nuclear THEN
    DELETE FROM public.stage_time_slots sts
    USING public.job_stage_instances jsi
    JOIN public.production_stages ps ON ps.id = jsi.production_stage_id
    WHERE sts.stage_instance_id = jsi.id
      AND COALESCE(sts.is_completed, false) = false   -- FIXED: use sts.is_completed (not jsi.is_completed)
      AND (p_start_from IS NULL OR sts.slot_start_time >= p_start_from)
      AND (p_division IS NULL OR ps.division = p_division);
  END IF;

  -- Delegate to append-only scheduler for all pending jobs in the division
  SELECT r.wrote_slots, r.updated_jsi, COALESCE(r.violations, '[]'::jsonb)
    INTO v_wrote, v_updated, v_violations
  FROM public.scheduler_append_jobs(NULL::uuid[], FALSE, p_division) AS r;

  wrote_slots := COALESCE(v_wrote, 0);
  updated_jsi := COALESCE(v_updated, 0);
  violations  := COALESCE(v_violations, '[]'::jsonb);
  RETURN NEXT;
END;
$$;

-- Re-assert grants (no-op if already granted)
GRANT EXECUTE ON FUNCTION public.scheduler_reschedule_all_parallel_aware(TIMESTAMPTZ, TEXT, BOOLEAN) TO service_role;