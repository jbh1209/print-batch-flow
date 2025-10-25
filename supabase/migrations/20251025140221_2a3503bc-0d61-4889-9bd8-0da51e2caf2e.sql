-- Phase 1: Division-Aware Database Foundation

-- Step 1: Create divisions reference table
CREATE TABLE IF NOT EXISTS divisions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'package',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed divisions data
INSERT INTO divisions (code, name, color, icon, sort_order) VALUES 
  ('DIG', 'Digital', '#3B82F6', 'printer', 1),
  ('LGEFOR', 'Large Format', '#10B981', 'maximize', 2),
  ('LITHO', 'Litho', '#8B5CF6', 'stamp', 3),
  ('LABELS', 'Labels', '#F59E0B', 'tag', 4),
  ('PKG', 'Packaging', '#EC4899', 'package', 5)
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_divisions_code ON divisions(code);
CREATE INDEX IF NOT EXISTS idx_divisions_is_active ON divisions(is_active);

-- Step 2: Add division column to core tables
ALTER TABLE production_jobs 
  ADD COLUMN IF NOT EXISTS division TEXT NOT NULL DEFAULT 'DIG' 
  REFERENCES divisions(code);

ALTER TABLE production_stages 
  ADD COLUMN IF NOT EXISTS division TEXT NOT NULL DEFAULT 'DIG' 
  REFERENCES divisions(code);

ALTER TABLE job_stage_instances 
  ADD COLUMN IF NOT EXISTS division TEXT NOT NULL DEFAULT 'DIG' 
  REFERENCES divisions(code);

ALTER TABLE categories 
  ADD COLUMN IF NOT EXISTS division TEXT NOT NULL DEFAULT 'DIG' 
  REFERENCES divisions(code);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_production_jobs_division ON production_jobs(division);
CREATE INDEX IF NOT EXISTS idx_production_stages_division ON production_stages(division);
CREATE INDEX IF NOT EXISTS idx_job_stage_instances_division ON job_stage_instances(division);
CREATE INDEX IF NOT EXISTS idx_categories_division ON categories(division);

-- Step 3: Add division to shared resources (NULL = available to all divisions)
ALTER TABLE print_specifications ADD COLUMN IF NOT EXISTS division TEXT NULL REFERENCES divisions(code);
ALTER TABLE stage_specifications ADD COLUMN IF NOT EXISTS division TEXT NULL REFERENCES divisions(code);
ALTER TABLE printers ADD COLUMN IF NOT EXISTS division TEXT NULL REFERENCES divisions(code);
ALTER TABLE die_cutting_machines ADD COLUMN IF NOT EXISTS division TEXT NULL REFERENCES divisions(code);

-- Step 4: Add user permissions
ALTER TABLE user_groups 
  ADD COLUMN IF NOT EXISTS allowed_divisions TEXT[] DEFAULT ARRAY['DIG'];

-- Grant existing admin/manager groups access to all divisions
UPDATE user_groups 
SET allowed_divisions = ARRAY['DIG', 'LGEFOR', 'LITHO', 'LABELS', 'PKG']
WHERE name IN ('Admins', 'Managers', 'Production Managers', 'Supervisors')
  AND (allowed_divisions IS NULL OR allowed_divisions = ARRAY['DIG']);

-- Ensure all groups have at least DIG access
UPDATE user_groups 
SET allowed_divisions = ARRAY['DIG']
WHERE allowed_divisions IS NULL;

-- Step 5: Create helper function to check division access
CREATE OR REPLACE FUNCTION user_can_access_division(p_division TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_group_memberships ugm
    JOIN user_groups ug ON ug.id = ugm.group_id
    WHERE ugm.user_id = auth.uid()
      AND (
        p_division = ANY(ug.allowed_divisions)
        OR ug.allowed_divisions IS NULL  -- Super admin
        OR 'ALL' = ANY(ug.allowed_divisions)  -- Wildcard access
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Update RLS policies with division filtering

-- Production Jobs RLS
DROP POLICY IF EXISTS "Users can view accessible jobs" ON production_jobs;
CREATE POLICY "Users can view accessible jobs"
ON production_jobs FOR SELECT
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Users can update accessible jobs" ON production_jobs;
CREATE POLICY "Users can update accessible jobs"
ON production_jobs FOR UPDATE
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Users can delete accessible jobs" ON production_jobs;
CREATE POLICY "Users can delete accessible jobs"
ON production_jobs FOR DELETE
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Users can insert jobs" ON production_jobs;
CREATE POLICY "Users can insert jobs"
ON production_jobs FOR INSERT
WITH CHECK (user_can_access_division(division));

-- Production Stages RLS
DROP POLICY IF EXISTS "Authenticated users can view production stages" ON production_stages;
CREATE POLICY "Authenticated users can view production stages"
ON production_stages FOR SELECT
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Authenticated users can update production stages" ON production_stages;
CREATE POLICY "Authenticated users can update production stages"
ON production_stages FOR UPDATE
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Authenticated users can insert production stages" ON production_stages;
CREATE POLICY "Authenticated users can insert production stages"
ON production_stages FOR INSERT
WITH CHECK (user_can_access_division(division));

-- Job Stage Instances RLS
DROP POLICY IF EXISTS "Allow authenticated users to view job stages" ON job_stage_instances;
CREATE POLICY "Allow authenticated users to view job stages"
ON job_stage_instances FOR SELECT
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Allow authenticated users to update job stages" ON job_stage_instances;
CREATE POLICY "Allow authenticated users to update job stages"
ON job_stage_instances FOR UPDATE
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Allow authenticated users to delete job stages" ON job_stage_instances;
CREATE POLICY "Allow authenticated users to delete job stages"
ON job_stage_instances FOR DELETE
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Allow authenticated users to insert job stages" ON job_stage_instances;
CREATE POLICY "Allow authenticated users to insert job stages"
ON job_stage_instances FOR INSERT
WITH CHECK (user_can_access_division(division));

-- Categories RLS
DROP POLICY IF EXISTS "Users can view categories in their divisions" ON categories;
CREATE POLICY "Users can view categories in their divisions"
ON categories FOR SELECT
USING (user_can_access_division(division));

DROP POLICY IF EXISTS "Users can insert categories" ON categories;
CREATE POLICY "Users can insert categories"
ON categories FOR INSERT
WITH CHECK (user_can_access_division(division));

DROP POLICY IF EXISTS "Users can update categories" ON categories;
CREATE POLICY "Users can update categories"
ON categories FOR UPDATE
USING (user_can_access_division(division));