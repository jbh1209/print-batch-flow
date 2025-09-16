-- Fix wrapper functions to match base function return types exactly

-- First, let's check what the base functions actually return
-- and rebuild the wrappers with correct types

-- Wrapper: scheduler_reschedule_all_parallel_aware_edge()
-- Based on the error, the base function likely returns different column types
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware_edge()
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Disable timeouts to allow long-running scheduling
  PERFORM set_config('statement_timeout','0', true);
  PERFORM set_config('lock_timeout','0', true);

  -- Delegate to the original function with explicit column selection
  RETURN QUERY
  SELECT 
    r.wrote_slots,
    r.updated_jsi,
    r.violations
  FROM public.scheduler_reschedule_all_parallel_aware() AS r;
END;
$$;

-- Wrapper: scheduler_append_jobs_edge(...)
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs_edge(
  p_job_ids uuid[],
  p_start_from timestamp with time zone DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Disable timeouts to allow long-running scheduling
  PERFORM set_config('statement_timeout','0', true);
  PERFORM set_config('lock_timeout','0', true);

  -- Delegate to the original function with explicit column selection
  RETURN QUERY
  SELECT 
    r.wrote_slots,
    r.updated_jsi,
    r.violations
  FROM public.scheduler_append_jobs(
    p_job_ids => p_job_ids,
    p_start_from => p_start_from,
    p_only_if_unset => p_only_if_unset
  ) AS r;
END;
$$;