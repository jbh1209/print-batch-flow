-- Fix scheduler_resource_fill_optimized by delegating to the stable wrapper
-- This avoids the incorrect call to next_working_start(timestamptz, text)
-- and uses the division-aware scheduler path returning the expected JSON shape

-- 1) Drop existing function if present
DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized();

-- 2) Recreate as thin wrapper around simple_scheduler_wrapper
CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Call the new division-aware scheduler for all divisions, default start
  result := public.simple_scheduler_wrapper(NULL, NULL);
  RETURN result;
END;
$$;

-- Optional: clarify intent
COMMENT ON FUNCTION public.scheduler_resource_fill_optimized()
IS 'Thin wrapper delegating to simple_scheduler_wrapper(NULL, NULL); returns {wrote_slots, updated_jsi, violations, ...} for edge function compatibility.';
