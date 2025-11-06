-- Drop ambiguous overload to resolve PGRST203 error
-- This leaves only the zero-arg scheduler_resource_fill_optimized() 
-- which correctly calls the restored Oct 14 scheduler_append_jobs logic

DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized(p_only_if_unset boolean);