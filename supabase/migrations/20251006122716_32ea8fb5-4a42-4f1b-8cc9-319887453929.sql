-- Create or replace a consolidated permissions view expected by RPCs
-- This view aggregates user permissions from group memberships and grants full access to admins
CREATE OR REPLACE VIEW public.user_stage_permissions AS
WITH member_perms AS (
  SELECT 
    ugm.user_id,
    ugsp.production_stage_id,
    bool_or(COALESCE(ugsp.can_view, false)) AS can_view,
    bool_or(COALESCE(ugsp.can_edit, false)) AS can_edit,
    bool_or(COALESCE(ugsp.can_work, false)) AS can_work,
    bool_or(COALESCE(ugsp.can_manage, false)) AS can_manage
  FROM public.user_group_memberships ugm
  JOIN public.user_group_stage_permissions ugsp
    ON ugsp.user_group_id = ugm.group_id
  GROUP BY ugm.user_id, ugsp.production_stage_id
),
admin_perms AS (
  SELECT 
    ur.user_id,
    ps.id AS production_stage_id,
    TRUE AS can_view,
    TRUE AS can_edit,
    TRUE AS can_work,
    TRUE AS can_manage
  FROM public.user_roles ur
  CROSS JOIN public.production_stages ps
  WHERE ur.role = 'admin'
)
SELECT * FROM member_perms
UNION
SELECT * FROM admin_perms;

-- Helpful comment for maintainers
COMMENT ON VIEW public.user_stage_permissions IS 'Aggregated user-stage permissions from group memberships, with full-stage access granted to admin users. Used by RPCs like get_user_accessible_jobs*.';