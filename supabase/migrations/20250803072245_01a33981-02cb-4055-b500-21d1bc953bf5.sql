-- Fix the boolean aggregation issue in get_user_accessible_jobs_with_batch_allocation
-- Drop the current broken function
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(uuid, text, text, text);

-- Recreate the function with correct boolean aggregation using BOOL_OR
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(p_user_id uuid DEFAULT auth.uid(), p_permission_type text DEFAULT 'view'::text, p_status_filter text DEFAULT NULL::text, p_stage_filter text DEFAULT NULL::text)
 RETURNS TABLE(job_id uuid, id uuid, wo_no text, customer text, status text, due_date text, reference text, category_id uuid, category_name text, category_color text, current_stage_id uuid, current_stage_name text, current_stage_color text, current_stage_status text, user_can_view boolean, user_can_edit boolean, user_can_work boolean, user_can_manage boolean, workflow_progress numeric, total_stages integer, completed_stages integer, display_stage_name text, qty integer, has_custom_workflow boolean, manual_due_date text, batch_category text, is_in_batch_processing boolean, started_by uuid, started_by_name text, proof_emailed_at timestamp with time zone, is_batch_master boolean, batch_name text, constituent_job_count integer, current_stage_order integer, is_virtual_stage_entry boolean, stage_instance_id uuid, parent_job_id uuid, part_assignment text)
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
    COALESCE(c.color, '#6B7280') as category_color,
    jsi.production_stage_id as current_stage_id,
    COALESCE(ps.name, 'No Stage') as current_stage_name,
    COALESCE(ps.color, '#6B7280') as current_stage_color,
    COALESCE(jsi.status, 'pending') as current_stage_status,
    BOOL_OR(ugsp.can_view) as user_can_view,
    BOOL_OR(ugsp.can_edit) as user_can_edit,
    BOOL_OR(ugsp.can_work) as user_can_work,
    BOOL_OR(ugsp.can_manage) as user_can_manage,
    CASE 
      WHEN COUNT(all_jsi.id) > 0 THEN 
        ROUND((COUNT(CASE WHEN all_jsi.status = 'completed' THEN 1 END)::numeric / COUNT(all_jsi.id)::numeric) * 100, 1)
      ELSE 0
    END as workflow_progress,
    COUNT(all_jsi.id)::integer as total_stages,
    COUNT(CASE WHEN all_jsi.status = 'completed' THEN 1 END)::integer as completed_stages,
    COALESCE(ps.name, 'No Stage') as display_stage_name,
    pj.qty,
    pj.has_custom_workflow,
    pj.manual_due_date,
    pj.batch_category,
    CASE WHEN pj.status = 'In Batch Processing' THEN true ELSE false END as is_in_batch_processing,
    jsi.started_by,
    up.full_name as started_by_name,
    pj.proof_emailed_at,
    pj.is_batch_master,
    b.name as batch_name,
    COALESCE(bjr_count.constituent_count, 0)::integer as constituent_job_count,
    jsi.stage_order as current_stage_order,
    false as is_virtual_stage_entry,
    jsi.id as stage_instance_id,
    NULL::uuid as parent_job_id,
    jsi.part_assignment
  FROM public.production_jobs pj
  LEFT JOIN public.categories c ON pj.category_id = c.id
  LEFT JOIN public.job_stage_instances jsi ON (
    jsi.job_id = pj.id 
    AND jsi.job_table_name = 'production_jobs'
    AND jsi.status IN ('active', 'pending')
  )
  LEFT JOIN public.job_stage_instances all_jsi ON (
    all_jsi.job_id = pj.id 
    AND all_jsi.job_table_name = 'production_jobs'
  )
  LEFT JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  LEFT JOIN public.user_group_stage_permissions ugsp ON ps.id = ugsp.production_stage_id
  LEFT JOIN public.user_group_memberships ugm ON (
    ugsp.user_group_id = ugm.group_id 
    AND ugm.user_id = p_user_id
  )
  LEFT JOIN public.profiles up ON jsi.started_by = up.id
  LEFT JOIN public.batches b ON pj.batch_category = b.name
  LEFT JOIN (
    SELECT 
      bjr.batch_job_id,
      COUNT(*) as constituent_count
    FROM public.batch_job_references bjr
    WHERE bjr.status = 'in_batch'
    GROUP BY bjr.batch_job_id
  ) bjr_count ON pj.id = bjr_count.batch_job_id
  WHERE (ugsp.can_view = true OR pj.user_id = p_user_id)
    AND (p_status_filter IS NULL OR pj.status ILIKE '%' || p_status_filter || '%')
    AND (p_stage_filter IS NULL OR ps.name ILIKE '%' || p_stage_filter || '%')
  GROUP BY 
    pj.id, pj.wo_no, pj.customer, pj.status, pj.due_date, pj.reference,
    pj.category_id, c.name, c.color, jsi.production_stage_id, ps.name, ps.color,
    jsi.status, pj.qty, pj.has_custom_workflow, pj.manual_due_date, pj.batch_category,
    jsi.started_by, up.full_name, pj.proof_emailed_at, pj.is_batch_master, b.name,
    bjr_count.constituent_count, jsi.stage_order, jsi.id, jsi.part_assignment
  ORDER BY 
    CASE WHEN pj.is_expedited THEN 0 ELSE 1 END,
    pj.due_date ASC NULLS LAST,
    pj.created_at DESC;
END;
$function$;