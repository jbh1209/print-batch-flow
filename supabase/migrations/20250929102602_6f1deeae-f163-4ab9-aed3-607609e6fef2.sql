-- Increase timeout for simple_scheduler_wrapper to prevent statement timeout
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text);

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
  -- Increase timeout to allow parallel scheduler to complete
  SET LOCAL statement_timeout = '120s';
  SET LOCAL idle_in_transaction_session_timeout = '300s';
  
  CASE p_mode
    WHEN 'reschedule_all' THEN
      -- Use the parallel-aware scheduler that handles cover/text correctly
      SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware();
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'violations', result.violations,
        'mode', 'parallel_aware'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  RETURN response;
END;
$function$;