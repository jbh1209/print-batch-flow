-- FINAL SCHEDULER CLEAN — NO DIVISIONS, GUARDED AND IDEMPOTENT

-- 1) Drop any division-aware scheduler functions if present (no-op if absent)
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_by_division(text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_by_division(text);

-- 2) Drop any conflicting wrappers
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text);

-- 3) Drop any stray division-aware overloads of the core if they exist
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(text);

-- 4) Recreate wrapper that calls the Oct 24 core function: scheduler_reschedule_all_parallel_aware(p_start_from)
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all',
  p_start_from timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE 'simple_scheduler_wrapper (NO DIVISIONS) mode=%, start_from=%', p_mode, p_start_from;

  IF p_mode = 'reschedule_all' THEN
    -- Oct 24 behavior: use the parallel-aware scheduler without divisions
    result := public.scheduler_reschedule_all_parallel_aware(p_start_from);

    RETURN jsonb_build_object(
      'success', true,
      'updated_jsi', result->'updated_jsi',
      'wrote_slots', result->'wrote_slots',
      'mode', 'reschedule_all'
    );
  ELSE
    RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.simple_scheduler_wrapper(text, timestamp with time zone) IS 
  'Division-free wrapper: calls scheduler_reschedule_all_parallel_aware(p_start_from). No divisions.';