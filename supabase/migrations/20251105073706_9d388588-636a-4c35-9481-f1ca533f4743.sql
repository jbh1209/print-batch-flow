-- Remove all broken scheduler variants and keep only the working Oct 24th version
-- This removes the overly complex layering that was causing failures

-- Drop all the broken scheduler variants
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_sequential_enhanced(timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_sequential_fixed(timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_sequential_fixed_v2(timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_truly_sequential_v2(timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_completely_sequential(timestamp with time zone);
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_by_division(text, timestamp with time zone);

-- Keep only the working Oct 24th scheduler
-- public.scheduler_resource_fill_optimized() remains unchanged and active

COMMENT ON FUNCTION public.scheduler_resource_fill_optimized() IS 
'PRIMARY SCHEDULER - Uses resource-fill strategy from Oct 24th. No parameters needed. Clears non-completed slots and reschedules all proof-approved jobs.';