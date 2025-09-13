-- Fix operator role detection by updating stage permissions
-- Ensure equipment-specific groups have can_work=true for their stages

UPDATE user_group_stage_permissions 
SET can_work = true, updated_at = now()
WHERE user_group_id IN (
  SELECT id FROM user_groups 
  WHERE name ILIKE ANY(ARRAY[
    '%hunkeler%', 
    '%case%binding%', 
    '%perfect%binding%', 
    '%laminating%', 
    '%finishing%', 
    '%gathering%',
    '%saddle%',
    '%cutting%',
    '%folding%'
  ])
)
AND can_manage = true 
AND can_work = false;

-- Also ensure printing operators have proper permissions
UPDATE user_group_stage_permissions 
SET can_work = true, updated_at = now()
WHERE user_group_id IN (
  SELECT id FROM user_groups 
  WHERE name ILIKE ANY(ARRAY['%print%', '%hp%', '%press%'])
)
AND can_manage = true 
AND can_work = false;