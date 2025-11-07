-- ============================================================
-- FIX: Disambiguate scheduler_reschedule_all_parallel_aware call
-- ============================================================
-- Problem: simple_scheduler_wrapper calls scheduler_reschedule_all_parallel_aware
--          without naming the parameter, causing "function is not unique" error
-- Solution: Use named argument syntax to explicitly call single-param version
-- ============================================================

DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamptz) CASCADE;

CREATE FUNCTION public.simple_scheduler_wrapper(
  p_action text,
  p_start_from timestamptz DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE '🔧 simple_scheduler_wrapper called: action=%, start_from=%', p_action, p_start_from;

  IF p_action = 'reschedule_all' THEN
    -- Use named argument to disambiguate between overloaded function versions
    SELECT * INTO result 
    FROM public.scheduler_reschedule_all_parallel_aware(p_start_from => p_start_from);
    
    RETURN result;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unknown action: ' || p_action
    );
  END IF;
END;
$$;

ALTER FUNCTION public.simple_scheduler_wrapper(text, timestamptz) OWNER TO postgres;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Test the function:
-- SELECT public.simple_scheduler_wrapper('reschedule_all', now()::timestamptz);
-- 
-- Expected: JSONB with keys: success, scheduled_count, wrote_slots, violations
-- ============================================================
