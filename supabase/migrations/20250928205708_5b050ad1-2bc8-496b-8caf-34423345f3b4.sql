-- Fix field mapping in simple_scheduler_wrapper function
-- Map correct fields from scheduler_reschedule_all_sequential_fixed return value
-- Available fields: wrote_slots, updated_jsi, violations
-- Need to map: updated_jsi -> scheduled_count, derive success from wrote_slots > 0

DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text);

CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all'::text)
 RETURNS TABLE(scheduled_count integer, wrote_slots integer, success boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result_record RECORD;
BEGIN
  RAISE NOTICE 'Running simple_scheduler_wrapper with mode: %', p_mode;
  
  -- Call the main scheduler function and get the first result
  SELECT * INTO result_record
  FROM public.scheduler_reschedule_all_sequential_fixed()
  LIMIT 1;
  
  -- Return results with correct field mapping
  RETURN QUERY SELECT 
    COALESCE(result_record.updated_jsi, 0)::integer as scheduled_count,
    COALESCE(result_record.wrote_slots, 0)::integer as wrote_slots, 
    (COALESCE(result_record.wrote_slots, 0) > 0)::boolean as success;
    
  RAISE NOTICE 'Scheduler completed - scheduled: %, slots: %, success: %', 
    COALESCE(result_record.updated_jsi, 0),
    COALESCE(result_record.wrote_slots, 0),
    (COALESCE(result_record.wrote_slots, 0) > 0);
END;
$function$;