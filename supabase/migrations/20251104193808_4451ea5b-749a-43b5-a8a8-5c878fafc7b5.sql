-- Drop the ambiguous single-parameter overload of scheduler_reschedule_all_parallel_aware
-- This prevents PostgreSQL from being confused about which function to call
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(p_start_from timestamp with time zone);

-- The two-parameter version remains active:
-- public.scheduler_reschedule_all_parallel_aware(p_commit boolean, p_start_from timestamp with time zone)
-- This is the only version we should use going forward