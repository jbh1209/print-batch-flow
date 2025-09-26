-- Fix type mismatch: violations must be jsonb
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wrote_slots integer;
  updated_jsi integer;
  violations jsonb; -- changed from integer -> jsonb
  start_from_time timestamptz;
BEGIN
  CASE p_mode
    WHEN 'reschedule_all' THEN
      -- Calculate next working start time for reschedule_all mode only
      SELECT public.next_working_start(now()) INTO start_from_time;
      -- Call sequential scheduler and extract composite result
      SELECT * INTO wrote_slots, updated_jsi, violations 
      FROM public.scheduler_reschedule_all_sequential_fixed(start_from_time);
    ELSE
      -- All other modes call resource fill optimized (no parameters)
      SELECT * INTO wrote_slots, updated_jsi, violations 
      FROM public.scheduler_resource_fill_optimized();
  END CASE;

  -- Return JSON object from extracted values
  RETURN jsonb_build_object(
    'wrote_slots', wrote_slots,
    'updated_jsi', updated_jsi,
    'violations', COALESCE(violations, '[]'::jsonb)
  );
END;
$$;