-- Fix time-aware nightly scheduling: allow 3 AM cron to schedule for same day if working day
-- SURGICAL FIX: Only modify what's needed for time-awareness

-- 1. Update simple_scheduler_wrapper to accept optional p_start_from parameter
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all'::text,
  p_start_from timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '180s'
SET idle_in_transaction_session_timeout TO '300s'
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
      -- Pass p_start_from to the parallel-aware scheduler
      SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware(p_start_from);
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

-- 2. Update cron_nightly_reschedule_with_carryforward to pass time-aware start time
CREATE OR REPLACE FUNCTION public.cron_nightly_reschedule_with_carryforward()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  time_aware_start timestamptz;
BEGIN
  -- Calculate time-aware start: if 3 AM on working day, schedule for 8 AM same day
  time_aware_start := public.next_working_start(now());
  
  RAISE NOTICE 'Nightly cron starting at %, will schedule from %', now(), time_aware_start;
  
  -- Carry forward overdue jobs
  UPDATE production_jobs 
  SET status = 'In Production'
  WHERE status = 'Approved' 
    AND due_date < CURRENT_DATE;
  
  -- Run full reschedule with time-aware start time
  PERFORM public.simple_scheduler_wrapper('reschedule_all', time_aware_start);
END;
$function$;