-- Fix type casting issue in get_user_accessible_jobs function
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
  p_user_id uuid,
  p_permission_type text DEFAULT 'work'::text,
  p_status_filter text DEFAULT NULL::text,
  p_stage_filter text DEFAULT NULL::text
)
RETURNS TABLE (
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
  display_stage_name text,
  user_can_view boolean,
  user_can_edit boolean,
  user_can_work boolean,
  user_can_manage boolean,
  workflow_progress numeric,
  total_stages integer,
  completed_stages integer,
  qty integer,
  started_by uuid,
  started_by_name text,
  proof_emailed_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH job_current_stages AS (
    SELECT DISTINCT ON (jsi.job_id)
      jsi.job_id,
      jsi.production_stage_id as stage_id,
      jsi.status as stage_status,
      jsi.stage_order,
      jsi.proof_emailed_at,
      ps.name as stage_name,
      ps.color as stage_color
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status IN ('active', 'pending', 'awaiting_approval', 'changes_requested')
    ORDER BY jsi.job_id,
             CASE
               WHEN jsi.status = 'active' THEN 0
               WHEN jsi.status = 'changes_requested' THEN 1
               WHEN jsi.status = 'pending' THEN 2
               WHEN jsi.status = 'awaiting_approval' THEN 3
               ELSE 4
             END,
             jsi.stage_order ASC
  ),
  job_stage_counts AS (
    SELECT
      jsi.job_id,
      COUNT(*) as total_stages,
      COUNT(*) FILTER (WHERE jsi.status = 'completed') as completed_stages,
      CASE
        WHEN COUNT(*) > 0 THEN
          (COUNT(*) FILTER (WHERE jsi.status = 'completed')::numeric / COUNT(*)::numeric) * 100
        ELSE 0
      END as workflow_progress
    FROM job_stage_instances jsi
    WHERE jsi.job_table_name = 'production_jobs'
    GROUP BY jsi.job_id
  ),
  user_permissions AS (
    SELECT DISTINCT
      ps.id as stage_id,
      EXISTS (
        SELECT 1 FROM user_stage_permissions usp
        WHERE usp.user_id = p_user_id
          AND usp.production_stage_id = ps.id
          AND usp.can_view = true
      ) as can_view_stage,
      EXISTS (
        SELECT 1 FROM user_stage_permissions usp
        WHERE usp.user_id = p_user_id
          AND usp.production_stage_id = ps.id
          AND usp.can_edit = true
      ) as can_edit_stage,
      EXISTS (
        SELECT 1 FROM user_stage_permissions usp
        WHERE usp.user_id = p_user_id
          AND usp.production_stage_id = ps.id
          AND usp.can_work = true
      ) as can_work_stage,
      EXISTS (
        SELECT 1 FROM user_stage_permissions usp
        WHERE usp.user_id = p_user_id
          AND usp.production_stage_id = ps.id
          AND usp.can_manage = true
      ) as can_manage_stage
    FROM production_stages ps
  )
  SELECT
    pj.id as job_id,
    pj.wo_no,
    pj.customer,
    COALESCE(pj.status, 'Unknown') as status,
    pj.due_date,
    COALESCE(pj.reference, '') as reference,
    pj.category as category_id,
    COALESCE(c.name, 'No Category') as category_name,
    COALESCE(c.color, '#6B7280') as category_color,
    jcs.stage_id as current_stage_id,
    COALESCE(jcs.stage_name, 'No Stage') as current_stage_name,
    COALESCE(jcs.stage_color, '#6B7280') as current_stage_color,
    COALESCE(jcs.stage_status, 'pending') as current_stage_status,
    COALESCE(jcs.stage_name, 'No Stage') as display_stage_name,
    COALESCE(up.can_view_stage, false) as user_can_view,
    COALESCE(up.can_edit_stage, false) as user_can_edit,
    COALESCE(up.can_work_stage, false) as user_can_work,
    COALESCE(up.can_manage_stage, false) as user_can_manage,
    COALESCE(jsc.workflow_progress, 0) as workflow_progress,
    COALESCE(jsc.total_stages, 0)::integer as total_stages,
    COALESCE(jsc.completed_stages, 0)::integer as completed_stages,
    COALESCE(pj.qty, 0)::integer as qty,
    jcs_started.user_id as started_by,
    up_started.display_name as started_by_name,
    jcs.proof_emailed_at
  FROM production_jobs pj
  LEFT JOIN categories c ON c.id = pj.category
  LEFT JOIN job_current_stages jcs ON jcs.job_id = pj.id
  LEFT JOIN job_stage_counts jsc ON jsc.job_id = pj.id
  LEFT JOIN user_permissions up ON up.stage_id = jcs.stage_id
  LEFT JOIN LATERAL (
    SELECT jsi.started_by as user_id
    FROM job_stage_instances jsi
    WHERE jsi.job_id = pj.id
      AND jsi.production_stage_id = jcs.stage_id
      AND jsi.started_by IS NOT NULL
    LIMIT 1
  ) jcs_started ON true
  LEFT JOIN user_profiles up_started ON up_started.user_id = jcs_started.user_id
  WHERE (
    p_permission_type = 'view' AND up.can_view_stage = true OR
    p_permission_type = 'edit' AND up.can_edit_stage = true OR
    p_permission_type = 'work' AND up.can_work_stage = true OR
    p_permission_type = 'manage' AND up.can_manage_stage = true
  )
  AND (p_status_filter IS NULL OR pj.status = p_status_filter)
  AND (p_stage_filter IS NULL OR jcs.stage_id = p_stage_filter::uuid)
  ORDER BY pj.created_at DESC;
END;
$function$;