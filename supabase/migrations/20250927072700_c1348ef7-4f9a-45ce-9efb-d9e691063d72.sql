-- Create hardened simple_scheduler_wrapper to fix 500 error caused by JSON type mismatches
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text);

CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_from timestamptz;
  res RECORD;
  wrote_slots integer := 0;
  updated_jsi integer := 0;
  violations jsonb := '[]'::jsonb;
  mode_used text := COALESCE(p_mode, 'reschedule_all');
  error_details text;
BEGIN
  -- Wrap entire function in exception handler to return error JSON instead of throwing
  BEGIN
    RAISE NOTICE '[scheduler] wrapper start mode=%', mode_used;

    -- Determine next working start; fallback to now() if helper missing
    BEGIN
      SELECT public.next_working_start(now()) INTO start_from;
    EXCEPTION WHEN undefined_function THEN
      start_from := now();
    END;

    IF mode_used = 'reschedule_all' THEN
      -- Use the sequential, part-aware algorithm
      FOR res IN
        SELECT * FROM public.scheduler_reschedule_all_sequential_fixed(start_from)
      LOOP
        wrote_slots := COALESCE(res.wrote_slots, 0);
        updated_jsi := COALESCE(res.updated_jsi, 0);
        violations := COALESCE(res.violations, '[]'::jsonb);
      END LOOP;

      RAISE NOTICE '[scheduler] reschedule_all wrote_slots=% updated_jsi=%', wrote_slots, updated_jsi;

      RETURN jsonb_build_object(
        'mode', mode_used,
        'wrote_slots', wrote_slots,
        'updated_jsi', updated_jsi,
        'scheduled_count', updated_jsi,
        'violations', violations,
        'success', true
      );
    ELSE
      -- Fallback to resource-first algorithm when explicitly requested by other modes
      BEGIN
        FOR res IN
          SELECT * FROM public.scheduler_resource_fill_optimized()
        LOOP
          -- Try to map common fields defensively
          wrote_slots := COALESCE((to_jsonb(res)->>'wrote_slots')::int, 0);
          updated_jsi := COALESCE((to_jsonb(res)->>'scheduled_count')::int, (to_jsonb(res)->>'updated_jsi')::int, 0);
        END LOOP;

        RAISE NOTICE '[scheduler] mode % wrote_slots=% updated_jsi=%', mode_used, wrote_slots, updated_jsi;

        RETURN jsonb_build_object(
          'mode', mode_used,
          'wrote_slots', wrote_slots,
          'updated_jsi', updated_jsi,
          'scheduled_count', updated_jsi,
          'violations', jsonb_build_array(),
          'success', true
        );
      EXCEPTION WHEN undefined_function THEN
        RAISE NOTICE '[scheduler] fallback algorithm missing';
        RETURN jsonb_build_object(
          'mode', mode_used,
          'wrote_slots', 0,
          'updated_jsi', 0,
          'scheduled_count', 0,
          'violations', jsonb_build_array(),
          'success', false,
          'error', 'scheduler_resource_fill_optimized not available'
        );
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Catch all errors and return as JSON instead of throwing
    error_details := format('SQL Error %s: %s', SQLSTATE, SQLERRM);
    RAISE NOTICE '[scheduler] caught error: %', error_details;
    
    RETURN jsonb_build_object(
      'mode', mode_used,
      'wrote_slots', 0,
      'updated_jsi', 0,
      'scheduled_count', 0,
      'violations', jsonb_build_array(),
      'success', false,
      'error', error_details,
      'sqlstate', SQLSTATE
    );
  END;
END;
$$;