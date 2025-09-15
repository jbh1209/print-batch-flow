-- Create timeout-proof wrapper functions for the scheduler

-- Wrapper for parallel-aware scheduler that disables timeouts
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware_edge()
RETURNS TABLE(
  wrote_slots integer,
  updated_jsi integer,
  violations jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Disable statement and lock timeouts for this session
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);
  
  -- Call the working scheduler
  RETURN QUERY
  SELECT * FROM public.scheduler_reschedule_all_parallel_aware();
END;
$$;

-- Wrapper for append jobs that fixes ambiguous column reference
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs_edge(
  p_job_ids uuid[],
  p_start_from timestamptz DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(
  wrote_slots integer,
  updated_jsi integer,
  violations jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Disable statement and lock timeouts for this session
  PERFORM set_config('statement_timeout', '0', true);
  PERFORM set_config('lock_timeout', '0', true);
  
  -- Call the append jobs function with explicit parameter names to avoid ambiguity
  RETURN QUERY
  SELECT * FROM public.scheduler_append_jobs(
    p_job_ids := scheduler_append_jobs_edge.p_job_ids,
    p_start_from := scheduler_append_jobs_edge.p_start_from,
    p_only_if_unset := scheduler_append_jobs_edge.p_only_if_unset
  );
END;
$$;