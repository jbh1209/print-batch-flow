-- Phase 1: Emergency Lockdown - Secure job_stage_instances and production_stages

-- ============================================================================
-- SECURE job_stage_instances TABLE
-- ============================================================================

-- Drop overly permissive policy that allows ANY authenticated user to update
DROP POLICY IF EXISTS "Allow authenticated users to update job stages" ON job_stage_instances;

-- Drop existing policies to recreate them with proper security
DROP POLICY IF EXISTS "Admins can manage all job stages" ON job_stage_instances;
DROP POLICY IF EXISTS "Managers can manage all job stages" ON job_stage_instances;
DROP POLICY IF EXISTS "Operators can work on authorized stages" ON job_stage_instances;

-- Admins can manage all job stages
CREATE POLICY "Admins can manage all job stages"
ON job_stage_instances
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Managers can manage all job stages
CREATE POLICY "Managers can manage all job stages"
ON job_stage_instances
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'manager'
  )
);

-- Operators can only work on stages they have can_work permission for
CREATE POLICY "Operators can work on authorized stages"
ON job_stage_instances
FOR UPDATE
TO authenticated
USING (
  -- Check if user has can_work permission for this stage
  EXISTS (
    SELECT 1 
    FROM user_group_stage_permissions ugsp
    JOIN user_group_memberships ugm ON ugm.group_id = ugsp.user_group_id
    WHERE ugm.user_id = auth.uid()
      AND ugsp.production_stage_id = job_stage_instances.production_stage_id
      AND ugsp.can_work = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM user_group_stage_permissions ugsp
    JOIN user_group_memberships ugm ON ugm.group_id = ugsp.user_group_id
    WHERE ugm.user_id = auth.uid()
      AND ugsp.production_stage_id = job_stage_instances.production_stage_id
      AND ugsp.can_work = true
  )
);

-- ============================================================================
-- SECURE production_stages TABLE
-- ============================================================================

-- Drop existing policies to recreate them with proper security
DROP POLICY IF EXISTS "Allow all users to manage stages" ON production_stages;
DROP POLICY IF EXISTS "Only admins can modify production stages" ON production_stages;
DROP POLICY IF EXISTS "All users can view production stages" ON production_stages;

-- Only admins can modify production stages
CREATE POLICY "Only admins can modify production stages"
ON production_stages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- All authenticated users can view production stages (needed for production tracking)
CREATE POLICY "All users can view production stages"
ON production_stages
FOR SELECT
TO authenticated
USING (true);