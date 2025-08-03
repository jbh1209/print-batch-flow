-- Fix the column reference in get_user_accessible_jobs_with_batch_allocation function
-- Change pj.proof_emailed_at to jsi.proof_emailed_at since the column exists in job_stage_instances, not production_jobs

DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(uuid);

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
  proof_emailed_at text,
  is_batch_master boolean,
  batch_name text,
  constituent_job_count integer,
  parallel_stages jsonb,
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
  WITH user_permissions AS (
    SELECT 
      ps.id as stage_id,
      BOOL_OR(ugsp.can_view) as can_view,
      BOOL_OR(ugsp.can_edit) as can_edit,
      BOOL_OR(ugsp.can_work) as can_work,
      BOOL_OR(ugsp.can_manage) as can_manage
    FROM public.production_stages ps
    INNER JOIN public.user_group_stage_permissions ugsp ON ps.id = ugsp.production_stage_id
    INNER JOIN public.user_group_memberships ugm ON ugsp.user_group_id = ugm.group_id
    WHERE ugm.user_id = p_user_id
      AND ps.is_active = true
    GROUP BY ps.id
  ),
  job_stage_data AS (
    SELECT DISTINCT
      pj.id as job_id,
      pj.id,
      pj.wo_no,
      pj.customer,
      pj.status,
      COALESCE(pj.manual_due_date::text, pj.due_date::text) as due_date,
      pj.reference,
      pj.category_id,
      c.name as category_name,
      c.color as category_color,
      
      -- Current stage logic
      current_jsi.production_stage_id as current_stage_id,
      COALESCE(current_ps.name, 'Not Started') as current_stage_name,
      COALESCE(current_ps.color, '#6B7280') as current_stage_color,
      COALESCE(current_jsi.status, 'pending') as current_stage_status,
      
      -- User permissions for current stage
      COALESCE(up.can_view, false) as user_can_view,
      COALESCE(up.can_edit, false) as user_can_edit,
      COALESCE(up.can_work, false) as user_can_work,
      COALESCE(up.can_manage, false) as user_can_manage,
      
      -- Workflow progress
      CASE 
        WHEN total_stages_count.total = 0 THEN 0
        ELSE ROUND((completed_stages_count.completed::numeric / total_stages_count.total::numeric) * 100, 1)
      END as workflow_progress,
      
      total_stages_count.total as total_stages,
      completed_stages_count.completed as completed_stages,
      
      -- Display stage name with status
      CASE 
        WHEN current_jsi.status = 'active' THEN COALESCE(current_ps.name, 'Not Started') || ' (Active)'
        WHEN current_jsi.status = 'completed' THEN COALESCE(current_ps.name, 'Not Started') || ' (Completed)'
        WHEN current_jsi.status = 'pending' THEN COALESCE(current_ps.name, 'Not Started') || ' (Pending)'
        WHEN current_jsi.status = 'reworked' THEN COALESCE(current_ps.name, 'Not Started') || ' (Rework)'
        ELSE COALESCE(current_ps.name, 'Not Started')
      END as display_stage_name,
      
      pj.qty,
      COALESCE(pj.has_custom_workflow, false) as has_custom_workflow,
      pj.manual_due_date::text,
      pj.batch_category,
      COALESCE(pj.status = 'In Batch Processing', false) as is_in_batch_processing,
      
      -- Additional fields
      current_jsi.started_by,
      profiles.full_name as started_by_name,
      jsi.proof_emailed_at::text,  -- FIXED: Changed from pj.proof_emailed_at to jsi.proof_emailed_at
      
      -- Batch master properties
      COALESCE(pj.is_batch_master, false) as is_batch_master,
      pj.batch_category as batch_name,
      CASE WHEN pj.is_batch_master THEN pj.qty ELSE NULL END as constituent_job_count,
      
      -- Parallel stages support
      NULL::jsonb as parallel_stages,
      current_jsi.stage_order as current_stage_order,
      
      -- Virtual stage entry support
      false as is_virtual_stage_entry,
      current_jsi.id as stage_instance_id,
      NULL::uuid as parent_job_id,
      current_jsi.part_assignment
      
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
    LEFT JOIN user_permissions up ON current_jsi.production_stage_id = up.stage_id
    LEFT JOIN public.profiles ON current_jsi.started_by = profiles.id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) as total
      FROM public.job_stage_instances jsi_count
      WHERE jsi_count.job_id = pj.id 
        AND jsi_count.job_table_name = 'production_jobs'
    ) total_stages_count ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) as completed
      FROM public.job_stage_instances jsi_comp
      WHERE jsi_comp.job_id = pj.id 
        AND jsi_comp.job_table_name = 'production_jobs'
        AND jsi_comp.status = 'completed'
    ) completed_stages_count ON true
    LEFT JOIN LATERAL (
      SELECT jsi.proof_emailed_at
      FROM public.job_stage_instances jsi
      WHERE jsi.job_id = pj.id
        AND jsi.job_table_name = 'production_jobs'
        AND jsi.proof_emailed_at IS NOT NULL
      ORDER BY jsi.proof_emailed_at DESC
      LIMIT 1
    ) jsi ON true
  )
  SELECT * FROM job_stage_data;
END;
$function$;