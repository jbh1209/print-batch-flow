-- ============================================================================
-- SURGICAL RESTORATION: October 12th Working Scheduler
-- This migration removes ALL division-related changes added after Oct 12, 2024
-- ============================================================================

-- ============================================================================
-- PART 1: RESTORE RLS POLICIES ON job_stage_instances
-- Remove division-checking policies, restore role-based only
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view job stages" ON job_stage_instances;
DROP POLICY IF EXISTS "Allow authenticated users to update job stages" ON job_stage_instances;
DROP POLICY IF EXISTS "Allow authenticated users to insert job stages" ON job_stage_instances;
DROP POLICY IF EXISTS "Allow authenticated users to delete job stages" ON job_stage_instances;
DROP POLICY IF EXISTS "Users can view job stages in their divisions" ON job_stage_instances;
DROP POLICY IF EXISTS "Users can update job stages in their divisions" ON job_stage_instances;
DROP POLICY IF EXISTS "Users can insert job stages in their divisions" ON job_stage_instances;
DROP POLICY IF EXISTS "Users can delete job stages in their divisions" ON job_stage_instances;

-- Create October 12th policies (authenticated users only, no division check)
CREATE POLICY "Allow authenticated users to view job stages"
  ON job_stage_instances FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update job stages"
  ON job_stage_instances FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert job stages"
  ON job_stage_instances FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete job stages"
  ON job_stage_instances FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- PART 2: RESTORE simple_scheduler_wrapper (October 12th signature)
-- Drop ALL versions first, then create the correct one
-- ============================================================================

-- Drop all overloaded versions of simple_scheduler_wrapper
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(boolean, boolean, boolean, boolean, timestamp with time zone, uuid[], text);

-- Create October 12th version (2 parameters only)
CREATE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'all',
  p_start_from timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM public.scheduler_reschedule_all_parallel_aware(p_start_from);
END;
$$;

COMMENT ON FUNCTION public.simple_scheduler_wrapper IS 'October 12th wrapper - direct passthrough to parallel-aware scheduler, no division filtering';