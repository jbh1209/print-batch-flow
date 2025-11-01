-- Surgical fix: Rewire TABLE-returning scheduler functions to wrap JSONB versions
-- This eliminates ps.stage_name, resource_id, find_next_available_slot errors

-- 1) Patch simple_scheduler_wrapper to call JSONB scheduler_reschedule_all_parallel_aware
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all'::text,
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  core jsonb;
BEGIN
  -- Call the JSONB version with commit=true
  SELECT public.scheduler_reschedule_all_parallel_aware(
    p_commit := true,
    p_only_job_ids := NULL,
    p_base_start := COALESCE(p_start_from, now()),
    p_lookback_days := 7
  ) INTO core;

  -- Extract fields to match TABLE signature
  RETURN QUERY SELECT 
    (core->>'wrote_slots')::int AS wrote_slots,
    (core->>'updated_jsi')::int AS updated_jsi,
    COALESCE(core->'violations', '[]'::jsonb) AS violations;
END;
$$;

-- 2) Patch scheduler_reschedule_all_parallel_aware (TABLE version) to wrap JSONB version
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_only_job_ids uuid[] DEFAULT NULL::uuid[],
  p_base_start timestamp with time zone DEFAULT now(),
  p_lookback_days integer DEFAULT 7
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  core jsonb;
BEGIN
  -- Call the JSONB version (4-arg signature) with commit=true
  SELECT public.scheduler_reschedule_all_parallel_aware(
    p_commit := true,
    p_only_job_ids := p_only_job_ids,
    p_base_start := p_base_start,
    p_lookback_days := p_lookback_days
  ) INTO core;

  -- Extract fields to match TABLE signature
  RETURN QUERY SELECT 
    (core->>'wrote_slots')::int AS wrote_slots,
    (core->>'updated_jsi')::int AS updated_jsi,
    COALESCE(core->'violations', '[]'::jsonb) AS violations;
END;
$$;

-- 3) Patch scheduler_append_jobs (TABLE version) to wrap JSONB version
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[],
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  core jsonb;
BEGIN
  -- Call the JSONB version with commit=true if p_only_if_unset is true
  SELECT public.scheduler_append_jobs(
    p_job_ids := p_job_ids,
    p_commit := p_only_if_unset, -- Map p_only_if_unset to commit flag
    p_base_start := now()
  ) INTO core;

  -- Extract fields to match TABLE signature
  RETURN QUERY SELECT 
    (core->>'wrote_slots')::int AS wrote_slots,
    (core->>'updated_jsi')::int AS updated_jsi,
    COALESCE(core->'violations', '[]'::jsonb) AS violations;
END;
$$;