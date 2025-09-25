-- Fix critical JSON bug in simple_scheduler_wrapper that's breaking the scheduler
-- ISSUE: COALESCE(result_record.violations, 0) mixes jsonb array with integer
-- FIX: Use proper jsonb array instead of integer 0

CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result_record RECORD;
BEGIN
  RAISE NOTICE 'SQL Scheduler v1.0 (Protected) - Mode: %', p_mode;
  
  -- FIXED: Route reschedule_all to scheduler_reschedule_all_sequential_fixed as per v1.0 docs
  IF p_mode = 'reschedule_all' THEN
    SELECT * INTO result_record FROM public.scheduler_reschedule_all_sequential_fixed();
    
    -- CRITICAL FIX: Use proper jsonb array instead of mixing with integer
    RETURN jsonb_build_object(
      'scheduled_count', COALESCE(result_record.updated_jsi, 0),
      'wrote_slots', COALESCE(result_record.wrote_slots, 0),
      'success', true,
      'mode', p_mode,
      'violations', COALESCE(result_record.violations, '[]'::jsonb)  -- FIXED: jsonb array not integer
    );
  ELSE
    -- All other modes route to scheduler_resource_fill_optimized
    SELECT * INTO result_record FROM public.scheduler_resource_fill_optimized();
    
    RETURN jsonb_build_object(
      'scheduled_count', COALESCE(result_record.updated_jsi, 0),
      'wrote_slots', COALESCE(result_record.wrote_slots, 0), 
      'success', true,
      'mode', p_mode,
      'violations', '[]'::jsonb  -- Always jsonb array for consistency
    );
  END IF;
END;
$function$;