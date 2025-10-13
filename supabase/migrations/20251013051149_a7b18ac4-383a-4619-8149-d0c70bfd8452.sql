-- Drop both overloads of get_user_accessible_jobs to prevent conflicts
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(uuid);
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(uuid, text, text, text);

-- Recreate the four-argument version with fully qualified job_id references
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
  p_user_id uuid,
  p_permission_type text DEFAULT 'view'::text,
  p_status_filter text DEFAULT NULL::text,
  p_stage_filter text DEFAULT NULL::text
)
RETURNS TABLE(
  job_id uuid,
  wo_no text,
  customer text,
  status text,
  due_date timestamp with time zone,
  reference text,
  category_id uuid,
  category_name text,
  category_color text,
  current_stage_id uuid,
  current_stage_name text,
  current_stage_color text,
  current_stage_status text,
  user_can_view boolean,
  user_can_edit boolean,
  user_can_work boolean,
  user_can_manage boolean,
  workflow_progress integer,
  total_stages integer,
  completed_stages integer,
  display_stage_name text,
  qty integer,
  started_by uuid,
  started_by_name text,
  proof_emailed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pj.id)
    pj.id AS job_id,
    pj.wo_no,
    pj.customer,
    pj.status,
    pj.due_date,
    pj.reference,
    pj.category_id,
    cat.name AS category_name,
    cat.color AS category_color,
    jcs.stage_id AS current_stage_id,
    ps.name AS current_stage_name,
    ps.color AS current_stage_color,
    jcs.stage_status AS current_stage_status,
    COALESCE(perm.can_view, FALSE) AS user_can_view,
    COALESCE(perm.can_edit, FALSE) AS user_can_edit,
    COALESCE(perm.can_work, FALSE) AS user_can_work,
    COALESCE(perm.can_manage, FALSE) AS user_can_manage,
    COALESCE(wf.workflow_progress, 0) AS workflow_progress,
    COALESCE(wf.total_stages, 0) AS total_stages,
    COALESCE(wf.completed_stages, 0) AS completed_stages,
    COALESCE(ps.name, 'No Stage') AS display_stage_name,
    pj.qty,
    jcs.started_by,
    profiles.full_name AS started_by_name,
    jcs.proof_emailed_at
  FROM public.production_jobs pj
  LEFT JOIN public.categories cat ON pj.category_id = cat.id
  LEFT JOIN LATERAL (
    SELECT 
      jsi.production_stage_id AS stage_id,
      jsi.status AS stage_status,
      jsi.started_by,
      jsi.proof_emailed_at,
      jsi.stage_order
    FROM public.job_stage_instances jsi
    WHERE jsi.job_id = pj.id 
      AND jsi.job_table_name = 'production_jobs'
      AND jsi.status IN ('active', 'pending', 'awaiting_approval', 'changes_requested')
    ORDER BY 
      CASE WHEN jsi.status = 'active' THEN 1
           WHEN jsi.status = 'changes_requested' THEN 2
           WHEN jsi.status = 'awaiting_approval' THEN 3
           WHEN jsi.status = 'pending' THEN 4
           ELSE 5 END,
      jsi.stage_order ASC
    LIMIT 1
  ) jcs ON TRUE
  LEFT JOIN public.production_stages ps ON jcs.stage_id = ps.id
  LEFT JOIN public.profiles ON jcs.started_by = profiles.id
  LEFT JOIN LATERAL (
    SELECT
      jsi.job_id,
      ROUND((COUNT(*) FILTER (WHERE jsi.status IN ('completed', 'skipped'))::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100) AS workflow_progress,
      COUNT(*) AS total_stages,
      COUNT(*) FILTER (WHERE jsi.status IN ('completed', 'skipped')) AS completed_stages
    FROM public.job_stage_instances jsi
    WHERE jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
    GROUP BY jsi.job_id
  ) wf ON wf.job_id = pj.id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(bool_or(perm_type = 'view'), FALSE) AS can_view,
      COALESCE(bool_or(perm_type = 'edit'), FALSE) AS can_edit,
      COALESCE(bool_or(perm_type = 'work'), FALSE) AS can_work,
      COALESCE(bool_or(perm_type = 'manage'), FALSE) AS can_manage
    FROM (
      SELECT 'view' AS perm_type WHERE p_permission_type = 'view'
      UNION ALL
      SELECT 'edit' AS perm_type WHERE p_permission_type IN ('edit', 'work', 'manage')
      UNION ALL
      SELECT 'work' AS perm_type WHERE p_permission_type IN ('work', 'manage')
      UNION ALL
      SELECT 'manage' AS perm_type WHERE p_permission_type = 'manage'
    ) perms
    WHERE EXISTS (
      SELECT 1 FROM public.user_department_assignments uda
      JOIN public.production_stage_departments psd ON psd.department_id = uda.department_id
      WHERE uda.user_id = p_user_id
        AND psd.production_stage_id = jcs.stage_id
    )
  ) perm ON TRUE
  WHERE (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND (p_stage_filter IS NULL OR jcs.stage_id = NULLIF(p_stage_filter, '')::uuid)
  ORDER BY pj.id, jcs.stage_order;
END;
$function$;