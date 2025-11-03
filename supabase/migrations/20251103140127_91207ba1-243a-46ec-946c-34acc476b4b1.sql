-- RESTORE OCT 24 SCHEDULER (NO DIVISIONS)
-- Drop all division-aware wrappers and schedulers
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_by_division(text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(text);

-- Restore exact Oct 24 simple_scheduler_wrapper with p_mode parameter
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all',
  p_start_from timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result record;
  response jsonb;
BEGIN
  RAISE NOTICE 'Simple scheduler wrapper called with mode: %, start_from: %', p_mode, p_start_from;
  
  CASE p_mode
    WHEN 'reschedule_all' THEN
      SELECT * INTO result FROM public.scheduler_reschedule_all(p_start_from);
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'updated_jsi', result.updated_jsi,
        'mode', 'reschedule_all'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  
  RETURN response;
END;
$$;

COMMENT ON FUNCTION public.simple_scheduler_wrapper(text, timestamp with time zone) IS 
'Oct 24 scheduler wrapper - NO DIVISIONS. Calls scheduler_reschedule_all with optional start_from parameter.';