-- Restore Friday's 3-parameter scheduler_append_jobs signature
-- This wrapper accepts p_division but delegates to the stable 2-arg implementation

CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[],
  p_only_if_unset boolean DEFAULT true,
  p_division text DEFAULT NULL
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delegate to the existing 2-arg implementation
  -- Division parameter accepted for compatibility but not yet used
  RETURN QUERY SELECT * FROM public.scheduler_append_jobs(p_job_ids, p_only_if_unset);
END;
$$;