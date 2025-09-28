-- Fix type error in simple_scheduler_wrapper function that prevents scheduler from working
-- Need to drop and recreate due to return type change restriction
-- Error: COALESCE types jsonb and integer cannot be matched

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
  
  -- Call the main scheduler function
  SELECT * INTO result_record
  FROM public.scheduler_reschedule_all_sequential_fixed();
  
  -- Return results with proper type handling (removed violations field that caused jsonb/integer mismatch)
  RETURN QUERY SELECT 
    COALESCE(result_record.scheduled_count, 0)::integer,
    COALESCE(result_record.wrote_slots, 0)::integer, 
    COALESCE(result_record.success, true)::boolean;
    
  RAISE NOTICE 'Scheduler completed - scheduled: %, slots: %, success: %', 
    COALESCE(result_record.scheduled_count, 0),
    COALESCE(result_record.wrote_slots, 0),
    COALESCE(result_record.success, true);
END;
$function$;