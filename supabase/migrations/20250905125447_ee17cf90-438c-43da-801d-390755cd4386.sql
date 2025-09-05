-- Drop the old version of scheduler_resource_fill_optimized that takes parameters
-- This will resolve the "function is not unique" error
DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized(timestamp with time zone);

-- Ensure we still have the correct parameterless version
-- (This should already exist from the previous migration)