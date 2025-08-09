-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(uuid, text, text, uuid);

-- Create the corrected function with proper column qualification
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(
  p_user_id uuid DEFAULT auth.uid(),
  p_permission_type text DEFAULT 'work',
  p_status_filter text DEFAULT null,
  p_stage_filter uuid DEFAULT null
)
RETURNS TABLE(
  job_id uuid,
  wo_no text,
  customer text,
  status text,
  due_date date,
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
  proof_emailed_at timestamp with time zone,
  batch_category text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    pj.id as job_id,
    pj.wo_no,
    pj.customer,
    pj.status,
    pj.due_date,
    pj.reference,
    pj.category_id,
    c.name as category_name,
    c.color as category_color,
    jsi.production_stage_id as current_stage_id,
    ps.name as current_stage_name,
    ps.color as current_stage_color,
    jsi.status as current_stage_status,
    ps.name as display_stage_name,
    BOOL_OR(ugsp.can_view) as user_can_view,
    BOOL_OR(ugsp.can_edit) as user_can_edit,
    BOOL_OR(ugsp.can_work) as user_can_work,
    BOOL_OR(ugsp.can_manage) as user_can_manage,
    COALESCE(
      (SELECT COUNT(*) FROM public.job_stage_instances completed_jsi
       WHERE completed_jsi.job_id = pj.id 
       AND completed_jsi.job_table_name = 'production_jobs'
       AND completed_jsi.status = 'completed')::numeric /
      NULLIF((SELECT COUNT(*) FROM public.job_stage_instances total_jsi
              WHERE total_jsi.job_id = pj.id 
              AND total_jsi.job_table_name = 'production_jobs'), 0)::numeric * 100, 0
    ) as workflow_progress,
    (SELECT COUNT(*) FROM public.job_stage_instances total_jsi
     WHERE total_jsi.job_id = pj.id 
     AND total_jsi.job_table_name = 'production_jobs') as total_stages,
    (SELECT COUNT(*) FROM public.job_stage_instances completed_jsi
     WHERE completed_jsi.job_id = pj.id 
     AND completed_jsi.job_table_name = 'production_jobs'
     AND completed_jsi.status = 'completed') as completed_stages,
    pj.qty,
    jsi.started_by,
    p.full_name as started_by_name,
    jsi.proof_emailed_at,
    pj.batch_category
  FROM public.production_jobs pj
  LEFT JOIN public.categories c ON pj.category_id = c.id
  LEFT JOIN public.job_stage_instances jsi ON pj.id = jsi.job_id AND jsi.job_table_name = 'production_jobs'
  LEFT JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  LEFT JOIN public.user_group_stage_permissions ugsp ON ps.id = ugsp.production_stage_id
  LEFT JOIN public.user_group_memberships ugm ON ugsp.user_group_id = ugm.group_id
  LEFT JOIN public.profiles p ON jsi.started_by = p.id
  WHERE ugm.user_id = p_user_id
    AND (p_permission_type = 'view' AND ugsp.can_view = true OR
         p_permission_type = 'edit' AND ugsp.can_edit = true OR
         p_permission_type = 'work' AND ugsp.can_work = true OR
         p_permission_type = 'manage' AND ugsp.can_manage = true)
    AND (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND (p_stage_filter IS NULL OR jsi.production_stage_id = p_stage_filter)
    AND jsi.status IN ('active', 'pending')
  GROUP BY 
    pj.id, pj.wo_no, pj.customer, pj.status, pj.due_date, pj.reference, 
    pj.category_id, c.name, c.color, jsi.production_stage_id, ps.name, 
    ps.color, jsi.status, pj.qty, jsi.started_by, p.full_name, 
    jsi.proof_emailed_at, pj.batch_category
  ORDER BY pj.due_date ASC, pj.created_at DESC;
END;
$$;