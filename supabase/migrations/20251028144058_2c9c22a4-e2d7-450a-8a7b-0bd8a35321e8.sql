-- Drop broken function and restore stable scheduler without nonexistent columns
-- 1) DROP the broken function that returns JSONB
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(TIMESTAMPTZ, TEXT, BOOLEAN);

-- 2) Recreate reschedule function with TABLE return type (no predecessor_stage_ids reference)
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
      AND COALESCE(jsi.is_completed, false) = false
      AND (p_start_from IS NULL OR sts.slot_start_time >= p_start_from)
      AND (p_division IS NULL OR ps.division = p_division);
  END IF;

  -- Delegate to append-only scheduler for all pending jobs in the division (no bad column refs)
  SELECT r.wrote_slots, r.updated_jsi, COALESCE(r.violations, '[]'::jsonb)
    INTO v_wrote, v_updated, v_violations
  FROM public.scheduler_append_jobs(NULL::uuid[], FALSE, p_division) AS r;

  wrote_slots := COALESCE(v_wrote, 0);
  updated_jsi := COALESCE(v_updated, 0);
  violations  := COALESCE(v_violations, '[]'::jsonb);
  RETURN NEXT;
END;
$$;

-- 3) Recreate stable wrapper that never touches nonexistent columns and returns consistent JSON
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_commit         BOOLEAN DEFAULT TRUE,
  p_proposed       BOOLEAN DEFAULT FALSE,
  p_only_if_unset  BOOLEAN DEFAULT TRUE,
  p_nuclear        BOOLEAN DEFAULT FALSE,
  p_start_from     TIMESTAMPTZ DEFAULT NULL,
  p_only_job_ids   UUID[] DEFAULT NULL,
  p_division       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  core_wrote      INTEGER := 0;
  core_updated    INTEGER := 0;
  core_violations JSONB   := '[]'::jsonb;
BEGIN
  IF p_only_job_ids IS NOT NULL OR p_only_if_unset THEN
    SELECT r.wrote_slots, r.updated_jsi, COALESCE(r.violations, '[]'::jsonb)
      INTO core_wrote, core_updated, core_violations
    FROM public.scheduler_append_jobs(p_only_job_ids, TRUE, p_division) AS r;
  ELSE
    SELECT r.wrote_slots, r.updated_jsi, COALESCE(r.violations, '[]'::jsonb)
      INTO core_wrote, core_updated, core_violations
    FROM public.scheduler_reschedule_all_parallel_aware(p_start_from, p_division, p_nuclear) AS r;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'wrote_slots', core_wrote,
    'updated_jsi', core_updated,
    'violations', core_violations,
    'slots_written', core_wrote,
    'jobs_touched', core_updated,
    'scheduled', core_wrote,
    'jobs_considered', core_updated,
    'applied', jsonb_build_object('updated', core_updated)
  );
END;
$$;

-- 4) Grants
GRANT EXECUTE ON FUNCTION public.scheduler_reschedule_all_parallel_aware(TIMESTAMPTZ, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.simple_scheduler_wrapper(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID[], TEXT) TO service_role;