-- Harden simple_scheduler_wrapper to never raise errors to clients
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_division text DEFAULT NULL,
  p_start_from timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_slots int := 0;
  v_post_slots int := 0;
  v_wrote_slots int := 0;
  v_violations jsonb := '[]'::jsonb;
  v_err text;
BEGIN
  -- Count slots before
  SELECT COUNT(*) INTO v_prev_slots FROM public.stage_time_slots;

  -- Run scheduler with broad error handling
  BEGIN
    -- Preferred path
    PERFORM public.cron_nightly_reschedule_with_carryforward();
  EXCEPTION
    WHEN undefined_function THEN
      BEGIN
        -- Fallback path
        PERFORM public.cron_nightly_reschedule();
      EXCEPTION
        WHEN OTHERS THEN
          v_err := SQLERRM;
          RETURN jsonb_build_object(
            'success', false,
            'error', v_err,
            'updated_jsi', 0,
            'wrote_slots', 0,
            'violations', '[]'::jsonb,
            'division', p_division
          );
      END;
    WHEN OTHERS THEN
      v_err := SQLERRM;
      RETURN jsonb_build_object(
        'success', false,
        'error', v_err,
        'updated_jsi', 0,
        'wrote_slots', 0,
        'violations', '[]'::jsonb,
        'division', p_division
      );
  END;

  -- Count slots after (approximate)
  SELECT COUNT(*) INTO v_post_slots FROM public.stage_time_slots;
  v_wrote_slots := GREATEST(0, v_post_slots - v_prev_slots);

  -- Try to collect precedence validations (best-effort)
  BEGIN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'job_id', v.job_id,
          'violation_type', v.violation_type,
          'stage1_name', v.stage1_name,
          'stage1_order', v.stage1_order,
          'stage2_name', v.stage2_name,
          'stage2_order', v.stage2_order,
          'violation_details', v.violation_details
        )
      ),
      '[]'::jsonb
    )
    INTO v_violations
    FROM public.validate_job_scheduling_precedence() v;
  EXCEPTION
    WHEN OTHERS THEN
      v_violations := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'updated_jsi', 0,
    'wrote_slots', v_wrote_slots,
    'violations', v_violations,
    'division', p_division
  );
END;
$$;

COMMENT ON FUNCTION public.simple_scheduler_wrapper(text, timestamp with time zone)
IS 'Wrapper for scheduler operations; returns JSON with wrote_slots, updated_jsi, violations; catches errors and returns success=false.';