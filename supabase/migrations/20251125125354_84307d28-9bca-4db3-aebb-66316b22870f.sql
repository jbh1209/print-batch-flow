-- Fix proof queue visibility: Include awaiting_approval and changes_requested statuses
-- This ensures jobs remain visible after proof links are sent

-- Drop and recreate the function with the fix
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(
  p_user_id uuid DEFAULT NULL,
  p_permission_type text DEFAULT 'work',
  p_status_filter text DEFAULT NULL,
  p_stage_filter text DEFAULT NULL
)
RETURNS TABLE(
  job_id uuid,
  wo_no text,
  customer text,
  contact text,
  status text,
  due_date text,
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
  started_by uuid,
  started_by_name text,
  proof_emailed_at timestamp with time zone,
  batch_ready boolean,
  batch_allocated_at timestamp with time zone,
  batch_category text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pj.id::uuid AS job_id,
    pj.wo_no,
    pj.customer,
    pj.contact,
    pj.status,
    pj.due_date::text,
    pj.reference,
    c.id::uuid AS category_id,
    c.name AS category_name,
    c.color AS category_color,
    ps.id::uuid AS current_stage_id,
    ps.name AS current_stage_name,
    ps.color AS current_stage_color,
    COALESCE(jsi.status, 'pending') AS current_stage_status,
    up.can_view AS user_can_view,
    up.can_edit AS user_can_edit,
    up.can_work AS user_can_work,
    up.can_manage AS user_can_manage,
    CASE 
      WHEN stage_counts.total > 0 THEN 
        ROUND((stage_counts.completed::numeric / stage_counts.total::numeric) * 100, 1)
      ELSE 0
    END AS workflow_progress,
    stage_counts.total AS total_stages,
    stage_counts.completed AS completed_stages,
    CASE 
      WHEN jsi.is_rework = true THEN ps.name || ' (Rework)'
      ELSE ps.name
    END AS display_stage_name,
    pj.qty,
    jsi.started_by AS started_by,
    prof.full_name AS started_by_name,
    jsi.proof_emailed_at,
    pj.batch_ready,
    pj.batch_allocated_at,
    pj.batch_category
  FROM production_jobs pj
  LEFT JOIN categories c ON pj.category_id = c.id
  LEFT JOIN LATERAL (
    SELECT 
      jsi_inner.id,
      jsi_inner.production_stage_id,
      jsi_inner.status,
      jsi_inner.is_rework,
      jsi_inner.started_by,
      jsi_inner.proof_emailed_at
    FROM job_stage_instances jsi_inner
    WHERE jsi_inner.job_id = pj.id
    -- CRITICAL FIX: Include awaiting_approval and changes_requested so jobs don't disappear from proof queue
    AND COALESCE(jsi_inner.status, 'pending') IN ('pending', 'active', 'awaiting_approval', 'changes_requested')
    ORDER BY jsi_inner.stage_order ASC
    LIMIT 1
  ) jsi ON TRUE
  LEFT JOIN production_stages ps ON jsi.production_stage_id = ps.id
  LEFT JOIN profiles prof ON jsi.started_by = prof.id
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE jsi2.status = 'completed')::integer AS completed
    FROM job_stage_instances jsi2
    WHERE jsi2.job_id = pj.id
  ) stage_counts ON TRUE
  LEFT JOIN LATERAL (
    SELECT 
      COALESCE(bool_or(urp.permission_type = 'view'), FALSE) AS can_view,
      COALESCE(bool_or(urp.permission_type = 'edit'), FALSE) AS can_edit,
      COALESCE(bool_or(urp.permission_type = 'work'), FALSE) AS can_work,
      COALESCE(bool_or(urp.permission_type = 'manage'), FALSE) AS can_manage
    FROM user_role_permissions urp
    WHERE urp.user_id = p_user_id
      AND (urp.department_id = ps.stage_group_id OR urp.department_id IS NULL)
  ) up ON TRUE
  WHERE (
    p_user_id IS NULL
    OR up.can_view = TRUE
    OR up.can_edit = TRUE
    OR up.can_work = TRUE
    OR up.can_manage = TRUE
  )
  AND (p_status_filter IS NULL OR pj.status = p_status_filter)
  AND (p_stage_filter IS NULL OR ps.id::text = p_stage_filter)
  ORDER BY 
    CASE WHEN pj.is_expedited = true THEN 0 ELSE 1 END,
    pj.due_date ASC NULLS LAST,
    pj.wo_no ASC;
END;
$$;