-- Create timeout-safe wrappers with normalized return types (violations as text[])
-- These call the proven underlying scheduler functions and avoid statement/lock timeouts

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware_edge()
RETURNS TABLE (
  wrote_slots integer,
  updated_jsi integer,
  violations text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disable timeouts for the duration of this function
  PERFORM set_config('statement_timeout','0', true);
  PERFORM set_config('lock_timeout','0', true);

  -- Delegate to the original function and return its shape
  RETURN QUERY
  SELECT wrote_slots, updated_jsi, violations
  FROM public.scheduler_reschedule_all_parallel_aware();
END;
$$;


CREATE OR REPLACE FUNCTION public.scheduler_append_jobs_edge(
  p_job_ids uuid[],
  p_start_from timestamptz DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE (
  wrote_slots integer,
  updated_jsi integer,
  violations text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disable timeouts for the duration of this function
  PERFORM set_config('statement_timeout','0', true);
  PERFORM set_config('lock_timeout','0', true);

  -- Delegate to the original function and return its shape
  RETURN QUERY
  SELECT wrote_slots, updated_jsi, violations
  FROM public.scheduler_append_jobs(
    p_job_ids => p_job_ids,
    p_start_from => p_start_from,
    p_only_if_unset => p_only_if_unset
  );
END;
$$;