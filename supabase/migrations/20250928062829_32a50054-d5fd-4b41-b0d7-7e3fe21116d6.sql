-- Fix versioned scheduler functions to avoid redundant column-definition errors
-- Replace bodies to use RETURN QUERY SELECT ... FROM function-call style

-- 1) simple_scheduler_wrapper_20241227_1445
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper_20241227_1445(
  p_mode text DEFAULT 'reschedule_all'::text,
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Call canonical wrapper and adapt to versioned response
  RETURN QUERY
  SELECT 
    COALESCE(sw.scheduled_count, 0)::integer,
    COALESCE(sw.wrote_slots, 0)::integer,
    COALESCE(sw.success, true)::boolean,
    'parallel_parts'::text,
    '20241227_1445'::text
  FROM public.simple_scheduler_wrapper(p_mode) AS sw;
END;
$function$;

-- 2) scheduler_reschedule_all_parallel_parts_20241227_1445
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_parts_20241227_1445(
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT r.scheduled_count, r.wrote_slots, r.success, r.mode, r.version
  FROM public.simple_scheduler_wrapper_20241227_1445('reschedule_all', p_start_from) r;
END;
$function$;

-- 3) scheduler_append_jobs_20241227_1445
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs_20241227_1445(
  p_job_ids uuid[],
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(
  scheduled_count integer,
  wrote_slots integer,
  success boolean,
  mode text,
  version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Handle empty input
  IF p_job_ids IS NULL OR array_length(p_job_ids, 1) IS NULL OR array_length(p_job_ids, 1) = 0 THEN
    RETURN QUERY SELECT 0, 0, true, 'parallel_parts'::text, '20241227_1445'::text;
    RETURN;
  END IF;

  -- Try to call canonical append function if it exists
  BEGIN
    RETURN QUERY
    SELECT 
      COALESCE(sa.scheduled_count, 0)::integer,
      COALESCE(sa.wrote_slots, 0)::integer,
      COALESCE(sa.success, true)::boolean,
      'parallel_parts'::text,
      '20241227_1445'::text
    FROM public.scheduler_append_jobs(p_job_ids, p_start_from, p_only_if_unset) AS sa;
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
$function$;