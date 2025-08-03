-- Revert the initialize_custom_job_stages_with_specs function back to original interface
-- This reverts the previous migration that broke the Excel import interface

-- Drop the broken function version
DROP FUNCTION IF EXISTS public.initialize_custom_job_stages_with_specs(uuid, text, jsonb, uuid);

-- The original function should still exist with p_stage_mappings parameter
-- If it doesn't exist, we'll need to restore it with the correct signature