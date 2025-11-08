-- Add security settings to scheduler functions to prevent search path hijacking

ALTER FUNCTION public.find_available_gaps(uuid, integer, timestamp with time zone, integer, timestamp with time zone) 
  SET search_path TO 'public';

ALTER FUNCTION public.scheduler_reschedule_all_parallel_aware(timestamp with time zone) 
  SET search_path TO 'public';

ALTER FUNCTION public.simple_scheduler_wrapper(text, timestamp with time zone) 
  SET search_path TO 'public';

ALTER FUNCTION public.cron_nightly_reschedule_with_carryforward() 
  SET search_path TO 'public';