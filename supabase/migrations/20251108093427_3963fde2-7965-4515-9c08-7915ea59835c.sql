-- ============================================================
-- FIX: Restore p_mode parameter name to match edge function
-- ============================================================
-- Problem: Edge function calls with p_mode, but DB function expects p_action
-- Solution: Change parameter name back to p_mode
-- ============================================================

DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamptz) CASCADE;

CREATE FUNCTION public.simple_scheduler_wrapper(
  p_mode text,
  p_start_from timestamptz DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  RAISE NOTICE '🔧 simple_scheduler_wrapper: mode=%, start_from=%', p_mode, p_start_from;

  IF p_mode = 'reschedule_all' THEN
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
      'error', 'Unknown mode: ' || p_mode
    );
  END IF;
END;
$$;

ALTER FUNCTION public.simple_scheduler_wrapper(text, timestamptz) OWNER TO postgres;