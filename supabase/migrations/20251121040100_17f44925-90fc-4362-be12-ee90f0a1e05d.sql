-- Fix user_stage_permissions view to properly aggregate permissions
-- This prevents duplicate rows when users have both admin role and group memberships

DROP VIEW IF EXISTS user_stage_permissions;

CREATE VIEW user_stage_permissions AS
WITH member_perms AS (
  SELECT 
    ugm.user_id,
    ugsp.production_stage_id,
    bool_or(COALESCE(ugsp.can_view, false)) AS can_view,
    bool_or(COALESCE(ugsp.can_edit, false)) AS can_edit,
    bool_or(COALESCE(ugsp.can_work, false)) AS can_work,
    bool_or(COALESCE(ugsp.can_manage, false)) AS can_manage
  FROM user_group_memberships ugm
  JOIN user_group_stage_permissions ugsp ON ugsp.user_group_id = ugm.group_id
  GROUP BY ugm.user_id, ugsp.production_stage_id
),
admin_perms AS (
  SELECT 
    ur.user_id,
    ps.id AS production_stage_id,
    true AS can_view,
    true AS can_edit,
    true AS can_work,
    true AS can_manage
  FROM user_roles ur
  CROSS JOIN production_stages ps
  WHERE ur.role = 'admin'
),
all_perms AS (
  SELECT * FROM member_perms
  UNION ALL
  SELECT * FROM admin_perms
)
SELECT 
  user_id,
  production_stage_id,
  bool_or(can_view) AS can_view,
  bool_or(can_edit) AS can_edit,
  bool_or(can_work) AS can_work,
  bool_or(can_manage) AS can_manage
FROM all_perms
GROUP BY user_id, production_stage_id;