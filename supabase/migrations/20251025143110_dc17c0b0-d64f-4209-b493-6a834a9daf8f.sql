-- Fix: Grant admin and management groups access to all divisions
-- The previous migration used incorrect group names

UPDATE user_groups 
SET allowed_divisions = ARRAY['DIG', 'LGEFOR', 'LITHO', 'LABELS', 'PKG']
WHERE name IN ('Administrators', 'Management', 'Sales');

-- Also update any other groups that should have multi-division access
-- You can customize this list based on your needs