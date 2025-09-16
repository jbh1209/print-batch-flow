-- Fix redundant column definition lists in edge wrappers
-- Keeps signatures, SECURITY DEFINER, and timeout protections intact.

-- Wrapper: scheduler_reschedule_all_parallel_aware_edge()
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware_edge()
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Disable timeouts to allow long-running scheduling
  PERFORM set_config('statement_timeout','0', true);
  PERFORM set_config('lock_timeout','0', true);

  -- Delegate to the original function; select all OUT columns from base function
  RETURN QUERY
  SELECT r.*
  FROM public.scheduler_reschedule_all_parallel_aware() AS r;
END;
$$;

-- Wrapper: scheduler_append_jobs_edge(...)
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs_edge(
  p_job_ids uuid[],
  p_start_from timestamp with time zone DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Disable timeouts to allow long-running scheduling
  PERFORM set_config('statement_timeout','0', true);
  PERFORM set_config('lock_timeout','0', true);

  -- Delegate to the original function; select all OUT columns from base function
  RETURN QUERY
  SELECT r.*
  FROM public.scheduler_append_jobs(
    p_job_ids => p_job_ids,
    p_start_from => p_start_from,
    p_only_if_unset => p_only_if_unset
  ) AS r;
END;
$$;