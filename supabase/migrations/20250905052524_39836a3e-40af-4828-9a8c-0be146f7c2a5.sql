-- Fix permission issues by making scheduler functions SECURITY DEFINER
-- This allows them to operate with elevated permissions for system operations

-- Update the main persistent queue scheduler function
ALTER FUNCTION public.scheduler_reschedule_all_persistent_queues(timestamp with time zone)
SECURITY DEFINER;

-- Update the wrapper function
ALTER FUNCTION public.simple_scheduler_wrapper(text)
SECURITY DEFINER;

-- Update other related scheduler functions that might need elevated permissions
ALTER FUNCTION public.scheduler_reschedule_all(timestamp with time zone)
SECURITY DEFINER;

ALTER FUNCTION public.scheduler_append_jobs(uuid[], timestamp with time zone, boolean)
SECURITY DEFINER;

ALTER FUNCTION public.scheduler_reschedule_all_barrier_fixed(timestamp with time zone)
SECURITY DEFINER;

-- Update utility functions that manipulate scheduling tables
ALTER FUNCTION public.initialize_queue_state()
SECURITY DEFINER;

ALTER FUNCTION public.update_stage_availability(uuid, timestamp with time zone, integer)
SECURITY DEFINER;

-- Grant necessary permissions to ensure the functions can execute properly
-- These functions need to be able to manipulate stage_time_slots and related tables
COMMENT ON FUNCTION public.scheduler_reschedule_all_persistent_queues IS 'Scheduler function with SECURITY DEFINER for elevated permissions';
COMMENT ON FUNCTION public.simple_scheduler_wrapper IS 'Scheduler wrapper with SECURITY DEFINER for elevated permissions';