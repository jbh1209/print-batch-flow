-- Fix table alias in get_user_accessible_jobs_with_batch_allocation function
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(
  p_user_id uuid,
  p_permission_type text DEFAULT 'view',
  p_status_filter text DEFAULT NULL,
  p_stage_filter text DEFAULT NULL
)
RETURNS TABLE(
  job_id uuid,
  id uuid,
  wo_no text,
  customer text,
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
  started_by text,
  started_by_name text,
  proof_emailed_at text,
  is_batch_master boolean,
  batch_name text,
  constituent_job_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    pj.id as job_id,
    pj.id,
    pj.wo_no,
    pj.customer,
    pj.status,
    pj.due_date::text,
    pj.reference,
    pj.category_id,
    COALESCE(c.name, 'No Category') as category_name,
    COALESCE(c.color, '#808080') as category_color,
    current_jsi.production_stage_id as current_stage_id,
    COALESCE(current_ps.name, 'No Active Stage') as current_stage_name,
    COALESCE(current_ps.color, '#808080') as current_stage_color,
    COALESCE(current_jsi.status, 'pending') as current_stage_status,
    COALESCE(perm.can_view, false) as user_can_view,
    COALESCE(perm.can_edit, false) as user_can_edit,
    COALESCE(perm.can_work, false) as user_can_work,
    COALESCE(perm.can_manage, false) as user_can_manage,
    COALESCE(
      CASE 
        WHEN total_stages.count > 0 THEN 
          (completed_stages.count::numeric / total_stages.count::numeric) * 100
        ELSE 0
      END, 0
    ) as workflow_progress,
    COALESCE(total_stages.count, 0) as total_stages,
    COALESCE(completed_stages.count, 0) as completed_stages,
    COALESCE(current_ps.name, 'No Active Stage') as display_stage_name,
    COALESCE(pj.qty, 0) as qty,
    COALESCE(pj.has_custom_workflow, false) as has_custom_workflow,
    pj.manual_due_date::text,
    pj.batch_category,
    COALESCE(pj.status = 'In Batch Processing', false) as is_in_batch_processing,
    current_jsi.started_by::text,
    started_user.full_name as started_by_name,
    current_jsi.proof_emailed_at::text,
    COALESCE(pj.is_batch_master, false) as is_batch_master,
    pj.batch_category as batch_name,
    CASE 
      WHEN pj.is_batch_master = true THEN pj.qty
      ELSE NULL
    END as constituent_job_count
  FROM public.production_jobs pj
  LEFT JOIN public.categories c ON pj.category_id = c.id
  LEFT JOIN LATERAL (
    SELECT jsi.*, ps.name as stage_name, ps.color as stage_color
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
    WHERE jsi.job_id = pj.id 
      AND jsi.job_table_name = 'production_jobs'
      AND jsi.status = 'active'
    ORDER BY jsi.stage_order ASC
    LIMIT 1
  ) current_jsi ON true
  LEFT JOIN public.production_stages current_ps ON current_jsi.production_stage_id = current_ps.id
  LEFT JOIN public.profiles started_user ON current_jsi.started_by = started_user.id
  LEFT JOIN LATERAL (
    SELECT 
      BOOL_OR(ugsp.can_view) as can_view,
      BOOL_OR(ugsp.can_edit) as can_edit,
      BOOL_OR(ugsp.can_work) as can_work,
      BOOL_OR(ugsp.can_manage) as can_manage
    FROM public.user_group_memberships ugm
    JOIN public.user_group_stage_permissions ugsp ON ugm.group_id = ugsp.user_group_id
    WHERE ugm.user_id = p_user_id
      AND (
        ugsp.production_stage_id = current_jsi.production_stage_id
        OR current_jsi.production_stage_id IS NULL
      )
  ) perm ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM public.job_stage_instances total_jsi
    WHERE total_jsi.job_id = pj.id 
      AND total_jsi.job_table_name = 'production_jobs'
  ) total_stages ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM public.job_stage_instances comp_jsi
    WHERE comp_jsi.job_id = pj.id 
      AND comp_jsi.job_table_name = 'production_jobs'
      AND comp_jsi.status = 'completed'
  ) completed_stages ON true
  WHERE (
    p_permission_type = 'view' AND COALESCE(perm.can_view, false) = true
    OR p_permission_type = 'edit' AND COALESCE(perm.can_edit, false) = true
    OR p_permission_type = 'work' AND COALESCE(perm.can_work, false) = true
    OR p_permission_type = 'manage' AND COALESCE(perm.can_manage, false) = true
  )
  AND (p_status_filter IS NULL OR pj.status ILIKE '%' || p_status_filter || '%')
  AND (p_stage_filter IS NULL OR current_ps.name ILIKE '%' || p_stage_filter || '%')
  ORDER BY 
    CASE WHEN pj.is_expedited = true THEN 0 ELSE 1 END,
    pj.due_date ASC NULLS LAST,
    pj.created_at ASC;
END;
$function$;