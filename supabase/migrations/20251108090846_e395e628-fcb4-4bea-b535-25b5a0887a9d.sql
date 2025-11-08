-- ============================================================
-- FIX: simple_scheduler_wrapper TABLE return type handling
-- ============================================================
-- Problem: scheduler_reschedule_all_parallel_aware returns TABLE,
--          but simple_scheduler_wrapper tries to assign it to JSONB
-- Solution: Use SELECT...INTO with jsonb_build_object to convert
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
  v_result jsonb;
BEGIN
  RAISE NOTICE '🔧 simple_scheduler_wrapper called: action=%, start_from=%', p_action, p_start_from;

  IF p_action = 'reschedule_all' THEN
    -- Convert TABLE output to JSONB using SELECT...INTO
    SELECT jsonb_build_object(
      'wrote_slots', r.wrote_slots,
      'updated_jsi', r.updated_jsi,
      'violations', r.violations
    )
    INTO v_result
    FROM public.scheduler_reschedule_all_parallel_aware(p_start_from => p_start_from) r;
    
    RETURN v_result;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unknown action: ' || p_action
    );
  END IF;
END;
$$;

ALTER FUNCTION public.simple_scheduler_wrapper(text, timestamptz) OWNER TO postgres;