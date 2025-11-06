-- Refactor scheduler_resource_fill_optimized to use uuid[] job IDs (no JSON casting)
-- and return consistent wrote_slots/updated_jsi fields

DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized();

CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized()
RETURNS public.scheduler_result_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_ids uuid[];
  v_res public.scheduler_result_type;
BEGIN
  -- Collect approved jobs in FIFO order strictly as uuid[]
  SELECT array_agg(j.id ORDER BY j.proof_approved_at NULLS LAST, j.created_at)
  INTO v_job_ids
  FROM public.production_jobs j
  WHERE j.proof_approved_at IS NOT NULL
    AND (j.status IS NULL OR j.status NOT IN ('cancelled','void'));

  -- Nothing to schedule
  IF v_job_ids IS NULL OR array_length(v_job_ids, 1) IS NULL THEN
    v_res.wrote_slots := 0;
    v_res.updated_jsi := 0;
    RETURN v_res;
  END IF;

  -- Run append scheduler over UUID array (no JSON anywhere)
  SELECT s.wrote_slots, s.updated_jsi
  INTO v_res.wrote_slots, v_res.updated_jsi
  FROM public.scheduler_append_jobs(
    p_job_ids => v_job_ids,
    p_only_if_unset => false
  ) AS s;

  RETURN v_res;
END;
$$;