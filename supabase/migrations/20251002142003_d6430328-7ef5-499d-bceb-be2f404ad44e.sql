-- Remove the single-parameter version causing PGRST203 conflict
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(p_mode text);

-- Verify: Only the 2-parameter version should remain:
-- public.simple_scheduler_wrapper(p_mode text, p_start_from timestamptz)