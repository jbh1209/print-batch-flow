-- Recreate wrappers exactly like the previously working approach
-- Drop current wrappers first
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware_edge();
DROP FUNCTION IF EXISTS public.scheduler_append_jobs_edge(uuid[], timestamptz, boolean);

-- Parallel-aware full reschedule wrapper
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware_edge()
RETURNS TABLE (
  wrote_slots integer,
  updated_jsi integer,
  violations jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disable timeouts to allow long-running scheduling
  PERFORM set_config('statement_timeout','0', true);
  PERFORM set_config('lock_timeout','0', true);

  -- Delegate to the original function; alias to avoid ambiguity
  RETURN QUERY
  SELECT r.wrote_slots, r.updated_jsi, r.violations
  FROM public.scheduler_reschedule_all_parallel_aware() AS r(wrote_slots integer, updated_jsi integer, violations jsonb);
END;
$$;

-- Append-jobs wrapper
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs_edge(
  p_job_ids uuid[],
  p_start_from timestamptz DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE (
  wrote_slots integer,
  updated_jsi integer,
  violations jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disable timeouts to allow long-running scheduling
  PERFORM set_config('statement_timeout','0', true);
  PERFORM set_config('lock_timeout','0', true);

  -- Delegate to the original function; alias to avoid ambiguity
  RETURN QUERY
  SELECT r.wrote_slots, r.updated_jsi, r.violations
  FROM public.scheduler_append_jobs(
    p_job_ids => p_job_ids,
    p_start_from => p_start_from,
    p_only_if_unset => p_only_if_unset
  ) AS r(wrote_slots integer, updated_jsi integer, violations jsonb);
END;
$$;