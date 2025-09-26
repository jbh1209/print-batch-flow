-- Reroute reschedule_all to per-part sequential scheduler
-- and normalize return payload for app compatibility

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
BEGIN
  -- Determine next working start; fallback to now() if helper missing
  BEGIN
    SELECT public.next_working_start(now()) INTO start_from;
  EXCEPTION WHEN undefined_function THEN
    start_from := now();
  END;

  IF COALESCE(p_mode, 'reschedule_all') = 'reschedule_all' THEN
    -- Use the sequential, part-aware algorithm
    FOR res IN
      SELECT * FROM public.scheduler_reschedule_all_sequential_fixed(start_from)
    LOOP
      wrote_slots := COALESCE(res.wrote_slots, 0);
      updated_jsi := COALESCE(res.updated_jsi, 0);
      violations := COALESCE(res.violations, '[]'::jsonb);
    END LOOP;

    RETURN jsonb_build_object(
      'mode', 'reschedule_all',
      'wrote_slots', wrote_slots,
      'updated_jsi', updated_jsi,
      'scheduled_count', updated_jsi, -- alias for compatibility
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

      RETURN jsonb_build_object(
        'mode', p_mode,
        'wrote_slots', wrote_slots,
        'updated_jsi', updated_jsi,
        'scheduled_count', updated_jsi,
        'violations', '[]'::jsonb,
        'success', true
      );
    EXCEPTION WHEN undefined_function THEN
      RETURN jsonb_build_object(
        'mode', p_mode,
        'wrote_slots', 0,
        'updated_jsi', 0,
        'scheduled_count', 0,
        'violations', '[]'::jsonb,
        'success', false,
        'error', 'scheduler_resource_fill_optimized not available'
      );
    END;
  END IF;
END;
$$;