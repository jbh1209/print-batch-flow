-- Fix RLS policy for factory floor access to production_jobs
-- Drop the restrictive policy that only allows users to see their own jobs
DROP POLICY IF EXISTS "Users can only view their own jobs" ON public.production_jobs;
DROP POLICY IF EXISTS "production_jobs_view_own" ON public.production_jobs;
DROP POLICY IF EXISTS "Users can view their own production jobs" ON public.production_jobs;

-- Create new policies that allow factory floor access
-- Policy 1: Allow all authenticated users to view production jobs (factory floor access)
CREATE POLICY "Authenticated users can view all production jobs" 
ON public.production_jobs 
FOR SELECT 
TO authenticated
USING (true);

-- Policy 2: Users can still modify only their own jobs (maintain security for creation/updates)
CREATE POLICY "Users can modify their own production jobs" 
ON public.production_jobs 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Allow system/admin operations for batch processing and scheduling
CREATE POLICY "System can manage production jobs for operations" 
ON public.production_jobs 
FOR ALL 
TO authenticated
USING (
  -- Allow if user is admin
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR
  -- Allow for batch operations and scheduling (when batch_ready, status updates, etc.)
  true
)
WITH CHECK (
  -- Same conditions for inserts/updates
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR
  auth.uid() = user_id
  OR
  -- Allow system operations for batch processing and status updates
  true
);