-- Fix simple_scheduler_wrapper to route to the PARALLEL-AWARE scheduler
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result record;
BEGIN
  CASE p_mode
    WHEN 'reschedule_all' THEN
      -- Use the PARALLEL-AWARE scheduler that honors stage dependencies AND parallel processing
      SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware();
      
      -- Return in expected format for UI compatibility
      RETURN jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'violations', result.violations,
        'mode', 'reschedule_all_parallel_aware'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
END;
$function$;