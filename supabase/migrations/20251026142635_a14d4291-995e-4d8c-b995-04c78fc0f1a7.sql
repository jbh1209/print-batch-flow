-- Drop the stale simple_scheduler_wrapper overload that uses p_mode and p_start_from
-- This prevents accidental calls to the old scheduler path that doesn't exclude DTP/Proof

DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(p_mode text, p_start_from timestamp with time zone);

-- Ensure we're only using the division-aware wrapper going forward
-- public.simple_scheduler_wrapper(p_division text DEFAULT NULL) remains active