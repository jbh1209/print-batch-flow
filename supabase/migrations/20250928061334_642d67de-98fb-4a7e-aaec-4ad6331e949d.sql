-- Drop all overloads of versioned scheduler functions
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper_20241227_1445(text);
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper_20241227_1445(text, timestamptz);
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper_20241227_1445(text, uuid[], timestamptz);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_parts_20241227_1445();
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_parts_20241227_1445(timestamptz);
DROP FUNCTION IF EXISTS public.scheduler_append_jobs_20241227_1445(uuid[], timestamptz);
DROP FUNCTION IF EXISTS public.scheduler_append_jobs_20241227_1445(uuid[], timestamptz, boolean);

-- Recreate: simple_scheduler_wrapper_20241227_1445 with single signature
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper_20241227_1445(
  p_mode text DEFAULT 'reschedule_all',
  p_start_from timestamptz DEFAULT NULL
)
RETURNS TABLE (
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_rec RECORD;
BEGIN
  -- Call canonical wrapper function
  SELECT * INTO result_rec
  FROM public.simple_scheduler_wrapper(p_mode) AS t(scheduled_count integer, wrote_slots integer, success boolean);
  
  -- Return with versioned response format
  RETURN QUERY
  SELECT 
    COALESCE(result_rec.scheduled_count, 0)::integer,
    COALESCE(result_rec.wrote_slots, 0)::integer,
    COALESCE(result_rec.success, true)::boolean,
    'parallel_parts'::text,
    '20241227_1445'::text;
END;
$$;

-- Recreate: scheduler_reschedule_all_parallel_parts_20241227_1445
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_parts_20241227_1445(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS TABLE (
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.simple_scheduler_wrapper_20241227_1445('reschedule_all', p_start_from);
END;
$$;

-- Recreate: scheduler_append_jobs_20241227_1445 with corrected logic
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs_20241227_1445(
  p_job_ids uuid[],
  p_start_from timestamptz DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE (
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_rec RECORD;
BEGIN
  -- Handle empty input
  IF p_job_ids IS NULL OR array_length(p_job_ids, 1) IS NULL OR array_length(p_job_ids, 1) = 0 THEN
    RETURN QUERY SELECT 0, 0, true, 'parallel_parts'::text, '20241227_1445'::text;
    RETURN;
  END IF;

  -- Try to call canonical append function if it exists
  BEGIN
    SELECT * INTO result_rec
    FROM public.scheduler_append_jobs(p_job_ids, p_start_from, p_only_if_unset) AS t(scheduled_count integer, wrote_slots integer, success boolean);
    
    RETURN QUERY
    SELECT 
      COALESCE(result_rec.scheduled_count, 0)::integer,
      COALESCE(result_rec.wrote_slots, 0)::integer,
      COALESCE(result_rec.success, true)::boolean,
      'parallel_parts'::text,
      '20241227_1445'::text;
  EXCEPTION
    WHEN undefined_function THEN
      -- Fallback to full reschedule
      RETURN QUERY
      SELECT r.scheduled_count, r.wrote_slots, r.success, r.mode, r.version
      FROM public.simple_scheduler_wrapper_20241227_1445('reschedule_all', p_start_from) r;
    WHEN others THEN
      -- Return failure
      RETURN QUERY SELECT 0, 0, false, 'parallel_parts'::text, '20241227_1445'::text;
  END;
END;
$$;