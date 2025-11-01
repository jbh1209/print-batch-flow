-- Create user_division_assignments table
CREATE TABLE user_division_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  division_code text NOT NULL REFERENCES divisions(code) ON DELETE CASCADE,
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  is_primary boolean DEFAULT false,
  UNIQUE(user_id, division_code)
);

CREATE INDEX idx_user_division_user ON user_division_assignments(user_id);
CREATE INDEX idx_user_division_code ON user_division_assignments(division_code);

-- Enable RLS
ALTER TABLE user_division_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own division assignments"
  ON user_division_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all division assignments"
  ON user_division_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Helper function to get user divisions
CREATE OR REPLACE FUNCTION get_user_divisions(p_user_id uuid)
RETURNS text[] AS $$
  SELECT COALESCE(
    array_agg(DISTINCT division_code ORDER BY division_code),
    ARRAY['DIG']::text[]
  )
  FROM user_division_assignments
  WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Update user_can_access_division function
CREATE OR REPLACE FUNCTION user_can_access_division(p_division text)
RETURNS boolean AS $$
BEGIN
  -- Admins can access all divisions
  IF EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;
  
  -- Check direct division assignment
  RETURN EXISTS (
    SELECT 1 FROM user_division_assignments
    WHERE user_id = auth.uid() 
    AND division_code = p_division
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Migrate existing group-based divisions to direct assignments
INSERT INTO user_division_assignments (user_id, division_code, assigned_at)
SELECT DISTINCT 
  ugm.user_id,
  unnest(ug.allowed_divisions) as division_code,
  now()
FROM user_group_memberships ugm
JOIN user_groups ug ON ug.id = ugm.group_id
WHERE ug.allowed_divisions IS NOT NULL
ON CONFLICT (user_id, division_code) DO NOTHING;

-- Set first division as primary for each user
WITH first_divisions AS (
  SELECT DISTINCT ON (user_id) 
    id, user_id
  FROM user_division_assignments
  ORDER BY user_id, assigned_at
)
UPDATE user_division_assignments
SET is_primary = true
WHERE id IN (SELECT id FROM first_divisions);