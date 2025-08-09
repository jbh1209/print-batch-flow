-- Fix the get_user_accessible_jobs_with_batch_allocation function
-- Remove the problematic ORDER BY pj.created_at that causes SQL error

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(p_user_id uuid DEFAULT auth.uid())
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
   started_by uuid, 
   started_by_name text, 
   proof_emailed_at timestamp with time zone, 
   is_batch_master boolean, 
   batch_name text, 
   constituent_job_count integer, 
   current_stage_order integer, 
   is_virtual_stage_entry boolean, 
   stage_instance_id uuid, 
   parent_job_id uuid, 
   part_assignment text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
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
    COALESCE(BOOL_OR(ugsp.can_view), false) as user_can_view,
    COALESCE(BOOL_OR(ugsp.can_edit), false) as user_can_edit,
    COALESCE(BOOL_OR(ugsp.can_work), false) as user_can_work,
    COALESCE(BOOL_OR(ugsp.can_manage), false) as user_can_manage,
    COALESCE(
      ROUND(
        (COUNT(completed_jsi.id)::numeric / NULLIF(COUNT(all_jsi.id)::numeric, 0)) * 100,
        1
      ),
      0
    ) as workflow_progress,
    COALESCE(COUNT(all_jsi.id), 0)::integer as total_stages,
    COALESCE(COUNT(completed_jsi.id), 0)::integer as completed_stages,
    COALESCE(ps.name, 'No Stage') as display_stage_name,
    COALESCE(pj.qty, 0) as qty,
    COALESCE(pj.has_custom_workflow, false) as has_custom_workflow,
    pj.manual_due_date::text,
    pj.batch_category,
    COALESCE(pj.is_batch_master, false) as is_in_batch_processing,
    jsi.started_by,
    COALESCE(p.full_name, 'Unknown') as started_by_name,
    jsi.proof_emailed_at,
    COALESCE(pj.is_batch_master, false) as is_batch_master,
    pj.batch_category as batch_name,
    CASE WHEN pj.is_batch_master THEN 1 ELSE 0 END as constituent_job_count,
    COALESCE(jsi.stage_order, 0) as current_stage_order,
    false as is_virtual_stage_entry,
    jsi.id as stage_instance_id,
    pj.id as parent_job_id,
    COALESCE(jsi.part_assignment, 'both') as part_assignment
  FROM public.production_jobs pj
  LEFT JOIN public.categories c ON pj.category_id = c.id
  LEFT JOIN public.job_stage_instances jsi ON (
    jsi.job_id = pj.id 
    AND jsi.job_table_name = 'production_jobs'
    AND jsi.status = 'active'
  )
  LEFT JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  LEFT JOIN public.user_group_stage_permissions ugsp ON ps.id = ugsp.production_stage_id
  LEFT JOIN public.user_group_memberships ugm ON ugsp.user_group_id = ugm.group_id
  LEFT JOIN public.profiles p ON jsi.started_by = p.id
  LEFT JOIN public.job_stage_instances all_jsi ON (
    all_jsi.job_id = pj.id 
    AND all_jsi.job_table_name = 'production_jobs'
  )
  LEFT JOIN public.job_stage_instances completed_jsi ON (
    completed_jsi.job_id = pj.id 
    AND completed_jsi.job_table_name = 'production_jobs'
    AND completed_jsi.status = 'completed'
  )
  WHERE ugm.user_id = p_user_id OR p_user_id IS NULL
  GROUP BY 
    pj.id, pj.wo_no, pj.customer, pj.status, pj.due_date, pj.reference,
    pj.category_id, c.name, c.color, jsi.production_stage_id, ps.name, ps.color,
    jsi.status, pj.qty, pj.has_custom_workflow, pj.manual_due_date, pj.batch_category,
    pj.is_batch_master, jsi.started_by, p.full_name, jsi.proof_emailed_at,
    jsi.stage_order, jsi.id, jsi.part_assignment;
END;
$function$;