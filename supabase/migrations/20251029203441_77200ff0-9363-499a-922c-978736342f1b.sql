-- ============================================
-- EMERGENCY TEMPORARY RLS POLICIES
-- Purpose: Allow authenticated users to read/update production data
--          without division checks during emergency stabilization
-- Status: TEMPORARY - Remove when Supabase restore completes
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE public.production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_stage_instances ENABLE ROW LEVEL SECURITY;

-- Temporary read policies for authenticated users
DROP POLICY IF EXISTS emergency_read_all_jobs ON public.production_jobs;
CREATE POLICY emergency_read_all_jobs
ON public.production_jobs
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS emergency_read_all_stages ON public.job_stage_instances;
CREATE POLICY emergency_read_all_stages
ON public.job_stage_instances
FOR SELECT
TO authenticated
USING (true);

-- Minimal write needed for operators: update stage instances (start/complete)
DROP POLICY IF EXISTS emergency_update_stages ON public.job_stage_instances;
CREATE POLICY emergency_update_stages
ON public.job_stage_instances
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Note: Additional policies for production_jobs updates not included
-- Add only if UI requires direct job status updates (uncommon)

COMMENT ON POLICY emergency_read_all_jobs ON public.production_jobs IS 
'EMERGENCY TEMPORARY: Allows all authenticated users to read jobs. Remove when restore completes.';

COMMENT ON POLICY emergency_read_all_stages ON public.job_stage_instances IS 
'EMERGENCY TEMPORARY: Allows all authenticated users to read stages. Remove when restore completes.';

COMMENT ON POLICY emergency_update_stages ON public.job_stage_instances IS 
'EMERGENCY TEMPORARY: Allows all authenticated users to update stages. Remove when restore completes.';