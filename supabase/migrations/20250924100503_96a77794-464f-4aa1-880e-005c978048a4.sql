-- Update the 3 AM cron job to use the PROVEN WORKING scheduler approach
-- Instead of calling scheduler_reschedule_all_parallel_aware directly,
-- call simple_scheduler_wrapper which routes to scheduler_resource_fill_optimized

CREATE OR REPLACE FUNCTION public.cron_nightly_reschedule_with_carryforward()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  carry_result RECORD;
  base_start_time timestamptz;
  scheduler_result jsonb;
BEGIN
  -- Get time-aware base start time
  base_start_time := next_shift_start_from_now();
  
  RAISE NOTICE 'Starting 3 AM reschedule with carry-forward. Base start time: %', base_start_time;
  
  -- Step 1: Carry forward overdue active jobs
  SELECT * INTO carry_result FROM carry_forward_overdue_active_jobs();
  
  RAISE NOTICE 'Carry-forward result: % jobs carried forward', carry_result.carried_forward_count;
  
  -- Step 2: Use the PROVEN WORKING scheduler (simple_scheduler_wrapper -> scheduler_resource_fill_optimized)
  SELECT simple_scheduler_wrapper('reschedule_all') INTO scheduler_result;
  
  RAISE NOTICE 'WORKING SCHEDULER completed. Scheduled % jobs, wrote % slots, success: %', 
    scheduler_result->>'scheduled_count',
    scheduler_result->>'wrote_slots', 
    scheduler_result->>'success';
    
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in 3 AM reschedule: %', SQLERRM;
  RAISE;
END;
$function$;