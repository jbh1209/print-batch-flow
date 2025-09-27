-- Fix scheduler function permissions - Add SECURITY DEFINER to new functions
-- This allows the functions to run with postgres privileges and bypass RLS policies

ALTER FUNCTION public.scheduler_reschedule_all_parallel_parts_20241227_1445() SECURITY DEFINER;
ALTER FUNCTION public.simple_scheduler_wrapper_20241227_1445(text) SECURITY DEFINER;  
ALTER FUNCTION public.scheduler_append_jobs_20241227_1445(uuid[], timestamptz, boolean) SECURITY DEFINER;

-- Ensure proper search path for security
ALTER FUNCTION public.scheduler_reschedule_all_parallel_parts_20241227_1445() SET search_path = public;
ALTER FUNCTION public.simple_scheduler_wrapper_20241227_1445(text) SET search_path = public;
ALTER FUNCTION public.scheduler_append_jobs_20241227_1445(uuid[], timestamptz, boolean) SET search_path = public;