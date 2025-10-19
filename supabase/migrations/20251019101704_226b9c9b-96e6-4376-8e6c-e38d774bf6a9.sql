-- Grant Sales group view-only permissions across all production stages
INSERT INTO user_group_stage_permissions (
  user_group_id,
  production_stage_id,
  can_view,
  can_edit,
  can_work,
  can_manage
)
SELECT 
  '50447b09-eb7a-4344-898d-eed5b0fe9e69'::uuid,
  ps.id,
  true,
  false,
  false,
  false
FROM production_stages ps
WHERE ps.is_active = true
ON CONFLICT (user_group_id, production_stage_id) 
DO UPDATE SET
  can_view = true,
  can_edit = false,
  can_work = false,
  can_manage = false,
  updated_at = now();