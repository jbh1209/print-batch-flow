-- Drop the 2-parameter version that's causing the conflict
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamp with time zone, boolean) CASCADE;