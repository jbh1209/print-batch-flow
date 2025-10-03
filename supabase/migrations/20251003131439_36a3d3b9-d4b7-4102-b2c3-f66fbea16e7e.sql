-- Drop existing jsi_minutes function (all overloads)
DROP FUNCTION IF EXISTS public.jsi_minutes(integer, integer);
DROP FUNCTION IF EXISTS public.jsi_minutes(integer, integer, integer);
DROP FUNCTION IF EXISTS public.jsi_minutes(integer, integer, integer, integer);

-- Create helper function to intelligently select duration minutes
-- Prioritizes remaining_minutes for partially completed/held stages
CREATE OR REPLACE FUNCTION public.jsi_minutes(
  p_scheduled_minutes integer,
  p_estimated_duration_minutes integer,
  p_remaining_minutes integer DEFAULT NULL,
  p_completion_percentage integer DEFAULT 0
) RETURNS integer
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  -- Priority 1: Use remaining_minutes if stage was held with partial completion
  IF p_remaining_minutes IS NOT NULL AND p_remaining_minutes > 0 THEN
    RETURN p_remaining_minutes;
  END IF;
  
  -- Priority 2: Use scheduled_minutes if already calculated
  IF p_scheduled_minutes IS NOT NULL AND p_scheduled_minutes > 0 THEN
    RETURN p_scheduled_minutes;
  END IF;
  
  -- Priority 3: Fall back to estimated duration
  RETURN COALESCE(p_estimated_duration_minutes, 0);
END;
$$;

COMMENT ON FUNCTION public.jsi_minutes IS 'Intelligently selects duration for stage scheduling: remaining_minutes > scheduled_minutes > estimated_duration_minutes';