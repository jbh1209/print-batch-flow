-- REVERT SCHEDULER TO SEPTEMBER 24TH PROTECTED STATE
-- Remove unauthorized cleanup call that's causing gaps
-- Restore to Version 1.0 configuration

CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Version 1.0 Protected Configuration
  -- Route reschedule_all to the ORIGINAL sequential function
  IF p_mode = 'reschedule_all' THEN
    -- ORIGINAL VERSION - NO CLEANUP CALL
    SELECT scheduler_reschedule_all_sequential_fixed() INTO result;
    RETURN result;
  ELSE
    -- All other modes use resource fill
    SELECT scheduler_resource_fill_optimized() INTO result;
    RETURN result;
  END IF;
END;
$$;