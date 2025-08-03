-- Drop the function version that has uuid parameter for p_stage_filter
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(uuid, text, text, uuid);

-- Ensure we only have the correct version with text parameters
-- This function should already exist with the correct signature (uuid, text, text, text)