-- Phase 6: Fix job visibility - remove proof_approved_at constraint and add awaiting_approval status

-- Fix 1: Update get_user_accessible_jobs_with_batch_allocation to show jobs awaiting approval
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(p_user_id uuid, p_permission_type text, p_status_filter text, p_stage_filter uuid);

CREATE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(
  p_user_id uuid DEFAULT NULL::uuid,
  p_permission_type text DEFAULT 'work'::text,
  p_status_filter text DEFAULT NULL::text,
  p_stage_filter uuid DEFAULT NULL::uuid
)
RETURNS TABLE (
  job_id uuid,
  wo_no text,
  job_name text,
  category_id uuid,
  category_name text,
  current_stage_id uuid,
  current_stage_name text,
  current_stage_status text,
  stage_order integer,
  job_status text,
  due_date date,
  created_at timestamptz,
  updated_at timestamptz,
  is_batch_master boolean,
  batch_size integer,
  proof_emailed_at timestamptz,
  proof_approved_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pj.id)
    pj.id as job_id,
    pj.wo_no,
    pj.job_name,
    pj.category_id,
    c.name as category_name,
    jsi.production_stage_id as current_stage_id,
    ps.name as current_stage_name,
    jsi.status as current_stage_status,
    jsi.stage_order,
    pj.status as job_status,
    pj.due_date,
    pj.created_at,
    pj.updated_at,
    pj.is_batch_master,
    pj.batch_size,
    jsi.proof_emailed_at,
    pj.proof_approved_at
  FROM production_jobs pj
  INNER JOIN job_stage_instances jsi ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
  INNER JOIN production_stages ps ON ps.id = jsi.production_stage_id
  LEFT JOIN categories c ON c.id = pj.category_id
  INNER JOIN user_stage_permissions usp ON usp.production_stage_id = jsi.production_stage_id AND usp.user_id = p_user_id
  WHERE jsi.status IN ('active', 'pending', 'awaiting_approval')
    AND (p_status_filter IS NULL OR jsi.status = p_status_filter)
    AND (p_stage_filter IS NULL OR jsi.production_stage_id = p_stage_filter)
    AND (
      CASE p_permission_type
        WHEN 'view' THEN (usp.can_view OR usp.can_manage)
        WHEN 'edit' THEN (usp.can_edit OR usp.can_manage)
        WHEN 'work' THEN (usp.can_work OR usp.can_manage)
        WHEN 'manage' THEN usp.can_manage
        ELSE (usp.can_work OR usp.can_manage)
      END
    ) = true
  ORDER BY pj.id, jsi.stage_order ASC;
END;
$$;

-- Fix 2: Update get_user_accessible_jobs to include awaiting_approval status
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(p_user_id uuid);

CREATE FUNCTION public.get_user_accessible_jobs(p_user_id uuid DEFAULT NULL::uuid)
RETURNS TABLE (
  job_id uuid,
  wo_no text,
  customer text,
  status text,
  due_date text,
  original_committed_due_date text,
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
  workflow_progress numeric,
  total_stages integer,
  completed_stages integer,
  display_stage_name text,
  qty integer,
  has_custom_workflow boolean,
  manual_due_date text,
  batch_category text,
  is_in_batch_processing boolean,
  started_by uuid,
  started_by_name text,
  proof_emailed_at timestamptz,
  is_batch_master boolean,
  batch_name text,
  constituent_job_count integer,
  contact text,
  effectiveduedate text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH job_current_stages AS (
    SELECT DISTINCT ON (jsi.job_id)
      jsi.job_id,
      jsi.production_stage_id,
      jsi.status,
      jsi.stage_order,
      jsi.proof_emailed_at,
      ps.name as stage_name,
      ps.color as stage_color
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status IN ('active', 'awaiting_approval', 'pending')
    ORDER BY jsi.job_id, 
      CASE 
        WHEN jsi.status = 'active' THEN 1
        WHEN jsi.status = 'awaiting_approval' THEN 2
        WHEN jsi.status = 'pending' THEN 3
        ELSE 4
      END,
      jsi.stage_order ASC
  ),
  job_workflow_stats AS (
    SELECT
      jsi.job_id,
      COUNT(*) as total_stages,
      SUM(CASE WHEN jsi.status = 'completed' THEN 1 ELSE 0 END) as completed_stages,
      ROUND(
        (SUM(CASE WHEN jsi.status = 'completed' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
        0
      ) as workflow_progress
    FROM job_stage_instances jsi
    WHERE jsi.job_table_name = 'production_jobs'
    GROUP BY jsi.job_id
  )
  SELECT
    pj.id as job_id,
    pj.wo_no,
    pj.customer,
    pj.status,
    pj.due_date::text,
    pj.original_committed_due_date::text,
    pj.reference,
    pj.category_id,
    COALESCE(c.name, 'Uncategorized') as category_name,
    COALESCE(c.color, '#6B7280') as category_color,
    jcs.production_stage_id as current_stage_id,
    jcs.stage_name as current_stage_name,
    jcs.stage_color as current_stage_color,
    jcs.status as current_stage_status,
    COALESCE(usp.can_view, false) as user_can_view,
    COALESCE(usp.can_edit, false) as user_can_edit,
    COALESCE(usp.can_work, false) as user_can_work,
    COALESCE(usp.can_manage, false) as user_can_manage,
    COALESCE(jws.workflow_progress, 0) as workflow_progress,
    COALESCE(jws.total_stages, 0) as total_stages,
    COALESCE(jws.completed_stages, 0) as completed_stages,
    jcs.stage_name as display_stage_name,
    pj.qty,
    pj.has_custom_workflow,
    pj.manual_due_date::text,
    pj.batch_category,
    pj.is_in_batch_processing,
    pj.started_by,
    up.full_name as started_by_name,
    jcs.proof_emailed_at,
    COALESCE(pj.is_batch_master, false) as is_batch_master,
    pj.batch_name,
    pj.batch_size as constituent_job_count,
    pj.contact,
    COALESCE(pj.manual_due_date::text, pj.due_date::text) as effectiveduedate
  FROM production_jobs pj
  INNER JOIN job_current_stages jcs ON jcs.job_id = pj.id
  LEFT JOIN categories c ON c.id = pj.category_id
  LEFT JOIN user_stage_permissions usp ON usp.production_stage_id = jcs.production_stage_id AND usp.user_id = p_user_id
  LEFT JOIN job_workflow_stats jws ON jws.job_id = pj.id
  LEFT JOIN profiles up ON up.user_id = pj.started_by
  WHERE (usp.can_view = true OR usp.can_edit = true OR usp.can_work = true OR usp.can_manage = true)
  ORDER BY pj.created_at DESC;
END;
$$;