-- Fix critical database function conflicts by cleaning up overloads
-- Drop ALL existing versions of the conflicting functions

DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(uuid, text, text, uuid);

-- Create single, definitive version of get_user_accessible_jobs with consistent signature
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
  p_user_id uuid DEFAULT NULL::uuid, 
  p_permission_type text DEFAULT 'work'::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_stage_filter text DEFAULT NULL::text
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
  proof_emailed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pj.id as job_id,
    pj.wo_no,
    pj.customer,
    pj.contact,
    pj.status,
    pj.due_date::text,
    pj.reference,
    pj.category_id,
    COALESCE(c.name, 'Unknown') as category_name,
    COALESCE(c.color, '#6B7280') as category_color,
    jsi.production_stage_id as current_stage_id,
    COALESCE(ps.name, 'No Stage') as current_stage_name,
    COALESCE(ps.color, '#6B7280') as current_stage_color,
    COALESCE(jsi.status, 'pending') as current_stage_status,
    true as user_can_view,
    true as user_can_edit,
    true as user_can_work,
    true as user_can_manage,
    COALESCE(
      (SELECT COUNT(*)::numeric * 100.0 / NULLIF(COUNT(*) FILTER (WHERE j2.status != 'completed'), 0)
       FROM job_stage_instances j2 
       WHERE j2.job_id = pj.id AND j2.job_table_name = 'production_jobs'
       AND j2.status = 'completed'), 
      0
    ) as workflow_progress,
    (SELECT COUNT(*)::integer FROM job_stage_instances j3 WHERE j3.job_id = pj.id AND j3.job_table_name = 'production_jobs') as total_stages,
    (SELECT COUNT(*)::integer FROM job_stage_instances j4 WHERE j4.job_id = pj.id AND j4.job_table_name = 'production_jobs' AND j4.status = 'completed') as completed_stages,
    COALESCE(ps.name, 'No Stage') as display_stage_name,
    pj.qty,
    jsi.started_by,
    COALESCE(p.full_name, 'Unknown') as started_by_name,
    jsi.proof_emailed_at
  FROM production_jobs pj
  LEFT JOIN categories c ON pj.category_id = c.id
  LEFT JOIN job_stage_instances jsi ON jsi.job_id = pj.id 
    AND jsi.job_table_name = 'production_jobs'
    AND COALESCE(jsi.status, 'pending') IN ('pending', 'active')
  LEFT JOIN production_stages ps ON jsi.production_stage_id = ps.id
  LEFT JOIN profiles p ON jsi.started_by = p.id
  WHERE (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND (p_stage_filter IS NULL OR ps.name ILIKE '%' || p_stage_filter || '%')
  ORDER BY pj.due_date ASC, pj.created_at ASC;
END;
$$;

-- Create single, definitive version of get_user_accessible_jobs_with_batch_allocation
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(
  p_user_id uuid DEFAULT NULL::uuid, 
  p_permission_type text DEFAULT 'work'::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_stage_filter text DEFAULT NULL::text
)
RETURNS TABLE(
  job_id uuid, 
  id uuid, 
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
  has_custom_workflow boolean, 
  manual_due_date text, 
  batch_category text, 
  is_in_batch_processing boolean, 
  started_by uuid, 
  started_by_name text, 
  proof_emailed_at timestamp with time zone, 
  is_batch_master boolean, 
  batch_name text, 
  constituent_job_count integer, 
  parallel_stages jsonb, 
  current_stage_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pj.id as job_id,
    pj.id,
    pj.wo_no,
    pj.customer,
    pj.contact,
    pj.status,
    pj.due_date::text,
    pj.reference,
    pj.category_id,
    COALESCE(c.name, 'Unknown') as category_name,
    COALESCE(c.color, '#6B7280') as category_color,
    jsi.production_stage_id as current_stage_id,
    COALESCE(ps.name, 'No Stage') as current_stage_name,
    COALESCE(ps.color, '#6B7280') as current_stage_color,
    COALESCE(jsi.status, 'pending') as current_stage_status,
    true as user_can_view,
    true as user_can_edit,
    true as user_can_work,
    true as user_can_manage,
    COALESCE(
      (SELECT COUNT(*)::numeric * 100.0 / NULLIF(COUNT(*) FILTER (WHERE j2.status != 'completed'), 0)
       FROM job_stage_instances j2 
       WHERE j2.job_id = pj.id AND j2.job_table_name = 'production_jobs'
       AND j2.status = 'completed'), 
      0
    ) as workflow_progress,
    (SELECT COUNT(*)::integer FROM job_stage_instances j3 WHERE j3.job_id = pj.id AND j3.job_table_name = 'production_jobs') as total_stages,
    (SELECT COUNT(*)::integer FROM job_stage_instances j4 WHERE j4.job_id = pj.id AND j4.job_table_name = 'production_jobs' AND j4.status = 'completed') as completed_stages,
    COALESCE(ps.name, 'No Stage') as display_stage_name,
    pj.qty,
    COALESCE(pj.has_custom_workflow, false) as has_custom_workflow,
    pj.manual_due_date::text,
    pj.batch_category,
    COALESCE(pj.is_in_batch_processing, false) as is_in_batch_processing,
    jsi.started_by,
    COALESCE(p.full_name, 'Unknown') as started_by_name,
    jsi.proof_emailed_at,
    COALESCE(pj.is_batch_master, false) as is_batch_master,
    pj.batch_name,
    pj.constituent_job_count,
    '[]'::jsonb as parallel_stages,
    jsi.stage_order as current_stage_order
  FROM production_jobs pj
  LEFT JOIN categories c ON pj.category_id = c.id
  LEFT JOIN job_stage_instances jsi ON jsi.job_id = pj.id 
    AND jsi.job_table_name = 'production_jobs'
    AND COALESCE(jsi.status, 'pending') IN ('pending', 'active')
  LEFT JOIN production_stages ps ON jsi.production_stage_id = ps.id
  LEFT JOIN profiles p ON jsi.started_by = p.id
  WHERE (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND (p_stage_filter IS NULL OR ps.name ILIKE '%' || p_stage_filter || '%')
  ORDER BY pj.due_date ASC, pj.created_at ASC;
END;
$$;