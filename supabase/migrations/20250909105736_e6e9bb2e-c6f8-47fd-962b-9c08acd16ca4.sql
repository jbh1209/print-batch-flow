-- RESTORE WORKING SCHEDULER: Switch back to scheduler_resource_fill_optimized
-- This function is more efficient and was working properly before

CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result record;
  response jsonb;
BEGIN
  CASE p_mode
    WHEN 'reschedule_all' THEN
      -- FIXED: Use the working scheduler_resource_fill_optimized instead of the broken parallel_aware one
      SELECT * INTO result FROM public.scheduler_resource_fill_optimized();
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'violations', result.violations,
        'mode', 'resource_fill_optimized'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  
  RETURN response;
END;
$function$;