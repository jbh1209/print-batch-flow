-- Drop and recreate wrapper functions with correct return types and column order

-- Drop existing wrapper functions first
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware_edge();
DROP FUNCTION IF EXISTS public.scheduler_append_jobs_edge(uuid[], timestamp with time zone, boolean);

-- Recreate scheduler_reschedule_all_parallel_aware_edge() with correct return type
-- Base function returns: TABLE(updated_jsi integer, wrote_slots integer, violations text[])
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware_edge()
RETURNS TABLE(updated_jsi integer, wrote_slots integer, violations text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Disable timeouts to allow long-running scheduling
  PERFORM set_config('statement_timeout','0', true);
  PERFORM set_config('lock_timeout','0', true);

  -- Delegate to the original function with matching column order
  RETURN QUERY
  SELECT 
    r.updated_jsi,
    r.wrote_slots,
    r.violations
  FROM public.scheduler_reschedule_all_parallel_aware() AS r;
END;
$$;

-- Recreate scheduler_append_jobs_edge() with correct return type  
-- Base function returns: TABLE(updated_jsi integer, wrote_slots integer)
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs_edge(
  p_job_ids uuid[],
  p_start_from timestamp with time zone DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(updated_jsi integer, wrote_slots integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Disable timeouts to allow long-running scheduling
  PERFORM set_config('statement_timeout','0', true);
  PERFORM set_config('lock_timeout','0', true);

  -- Delegate to the original function with matching column order
  RETURN QUERY
  SELECT 
    r.updated_jsi,
    r.wrote_slots
  FROM public.scheduler_append_jobs(
    p_job_ids => p_job_ids,
    p_start_from => p_start_from,
    p_only_if_unset => p_only_if_unset
  ) AS r;
END;
$$;