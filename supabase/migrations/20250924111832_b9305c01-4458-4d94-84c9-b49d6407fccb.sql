-- Fix Reschedule All to use original working scheduler from Monday morning
-- Update simple_scheduler_wrapper to call scheduler_reschedule_all_sequential_fixed (NOT v2)

DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text);

CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result_record RECORD;
  result_json jsonb;
BEGIN
  RAISE NOTICE 'Scheduler wrapper called with mode: %', p_mode;
  
  -- Route reschedule_all to the ORIGINAL SEQUENTIAL scheduler (Monday morning behavior)
  IF p_mode = 'reschedule_all' THEN
    RAISE NOTICE 'Using ORIGINAL SEQUENTIAL scheduler for reschedule_all (Monday morning behavior)';
    
    SELECT * INTO result_record 
    FROM public.scheduler_reschedule_all_sequential_fixed(NULL);
    
    -- Normalize the response to match expected format
    result_json := jsonb_build_object(
      'scheduled_count', COALESCE(result_record.updated_jsi, 0),
      'wrote_slots', COALESCE(result_record.wrote_slots, 0),
      'success', true,
      'mode', 'reschedule_all_sequential',
      'violations', COALESCE(result_record.violations, 0)
    );
    
  ELSE
    -- For other modes, use the resource-fill scheduler
    RAISE NOTICE 'Using resource-fill scheduler for mode: %', p_mode;
    
    SELECT * INTO result_record 
    FROM public.scheduler_resource_fill_optimized();
    
    -- Normalize the response
    result_json := jsonb_build_object(
      'scheduled_count', COALESCE(result_record.scheduled_count, 0),
      'wrote_slots', COALESCE(result_record.wrote_slots, 0), 
      'success', COALESCE(result_record.success, false),
      'mode', p_mode
    );
  END IF;
  
  RAISE NOTICE 'Scheduler wrapper completed: %', result_json;
  RETURN result_json;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in scheduler wrapper: %', SQLERRM;
  RETURN jsonb_build_object(
    'scheduled_count', 0,
    'wrote_slots', 0,
    'success', false,
    'error', SQLERRM,
    'mode', p_mode
  );
END;
$function$;