-- Drop and recreate simple_scheduler_wrapper to change return type from jsonb to json
-- This fixes the 500 error caused by JSON type mismatch

DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text);

CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all')
RETURNS json
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

    RETURN json_build_object(
      'mode', mode_used,
      'wrote_slots', wrote_slots,
      'updated_jsi', updated_jsi,
      'scheduled_count', updated_jsi, -- alias for compatibility
      'violations', violations::json,
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

      RETURN json_build_object(
        'mode', mode_used,
        'wrote_slots', wrote_slots,
        'updated_jsi', updated_jsi,
        'scheduled_count', updated_jsi,
        'violations', json_build_array(),
        'success', true
      );
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE '[scheduler] fallback algorithm missing';
      RETURN json_build_object(
        'mode', mode_used,
        'wrote_slots', 0,
        'updated_jsi', 0,
        'scheduled_count', 0,
        'violations', json_build_array(),
        'success', false,
        'error', 'scheduler_resource_fill_optimized not available'
      );
    END;
  END IF;
END;
$$;