-- Fix get_user_accessible_jobs functions to include user stage permission filtering
-- This restores the filtering that allows DTP operators to see DTP, Proof, and Batch jobs

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(p_user_id uuid DEFAULT NULL::uuid, p_permission_type text DEFAULT 'work'::text, p_status_filter text DEFAULT NULL::text, p_stage_filter text DEFAULT NULL::text)
 RETURNS TABLE(job_id uuid, wo_no text, customer text, contact text, status text, due_date text, reference text, category_id uuid, category_name text, category_color text, current_stage_id uuid, current_stage_name text, current_stage_color text, current_stage_status text, user_can_view boolean, user_can_edit boolean, user_can_work boolean, user_can_manage boolean, workflow_progress numeric, total_stages integer, completed_stages integer, display_stage_name text, qty integer, started_by uuid, started_by_name text, proof_emailed_at timestamp with time zone, has_custom_workflow boolean, manual_due_date text, batch_category text, is_in_batch_processing boolean, is_batch_master boolean, batch_name text, constituent_job_count integer, proof_approved_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH user_stage_permissions AS (
    SELECT 
      ps.id as production_stage_id,
      BOOL_OR(ugsp.can_view) as can_view,
      BOOL_OR(ugsp.can_edit) as can_edit,
      BOOL_OR(ugsp.can_work) as can_work,
      BOOL_OR(ugsp.can_manage) as can_manage
    FROM public.user_group_stage_permissions ugsp
    INNER JOIN public.user_group_memberships ugm ON ugsp.user_group_id = ugm.group_id
    INNER JOIN public.production_stages ps ON ugsp.production_stage_id = ps.id
    WHERE ugm.user_id = p_user_id
      AND ps.is_active = true
    GROUP BY ps.id
  ),
  job_current_stages AS (
    SELECT DISTINCT ON (jsi.job_id)
      jsi.job_id,
      jsi.production_stage_id,
      jsi.status,
      jsi.started_by,
      jsi.proof_emailed_at,
      ps.name as stage_name,
      ps.color as stage_color
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    INNER JOIN user_stage_permissions usp ON jsi.production_stage_id = usp.production_stage_id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status IN ('active', 'pending')
      AND (
        CASE p_permission_type
          WHEN 'view' THEN usp.can_view
          WHEN 'edit' THEN usp.can_edit
          WHEN 'work' THEN usp.can_work
          WHEN 'manage' THEN usp.can_manage
          ELSE usp.can_work
        END
      ) = true
    ORDER BY jsi.job_id, 
      CASE WHEN jsi.status = 'active' THEN 1 
           WHEN jsi.status = 'pending' THEN 2 
           ELSE 3 END,
      jsi.stage_order ASC
  ),
  batch_info as (
    SELECT 
      bjr.production_job_id,
      b.name as batch_name,
      (COUNT(*) OVER (PARTITION BY bjr.batch_id))::integer as constituent_job_count,
      (ROW_NUMBER() OVER (PARTITION BY bjr.batch_id ORDER BY bjr.created_at) = 1) as is_batch_master
    FROM batch_job_references bjr
    JOIN batches b ON bjr.batch_id = b.id
  ),
  total_stats AS (
    SELECT 
      jsi_stats.job_id,
      (COUNT(jsi_stats.id))::integer as total_stages,
      (COUNT(CASE WHEN jsi_stats.status = 'completed' THEN 1 END))::integer as completed_stages
    FROM job_stage_instances jsi_stats 
    WHERE jsi_stats.job_table_name = 'production_jobs'
    GROUP BY jsi_stats.job_id
  ),
  user_permissions AS (
    SELECT 
      pj_perms.id as job_id,
      true as can_view,
      true as can_edit,
      true as can_work,
      true as can_manage
    FROM production_jobs pj_perms
  )
  SELECT 
    pj.id as job_id,
    pj.wo_no,
    pj.customer,
    pj.contact,
    pj.status,
    pj.due_date::text,
    pj.reference,
    pj.category_id,
    COALESCE(c.name, 'Uncategorized') as category_name,
    COALESCE(c.color, '#6B7280') as category_color,
    jcs.production_stage_id as current_stage_id,
    COALESCE(jcs.stage_name, 'No Stage') as current_stage_name,
    COALESCE(jcs.stage_color, '#6B7280') as current_stage_color,
    COALESCE(jcs.status, 'pending') as current_stage_status,
    up.can_view as user_can_view,
    up.can_edit as user_can_edit,
    up.can_work as user_can_work,
    up.can_manage as user_can_manage,
    CASE 
      WHEN ts.total_stages > 0 THEN 
        (ts.completed_stages::numeric / ts.total_stages::numeric) * 100
      ELSE 0
    END as workflow_progress,
    COALESCE(ts.total_stages, 0) as total_stages,
    COALESCE(ts.completed_stages, 0) as completed_stages,
    COALESCE(jcs.stage_name, 'Ready to Start') as display_stage_name,
    pj.qty,
    jcs.started_by,
    COALESCE(p.full_name, 'Unknown') as started_by_name,
    jcs.proof_emailed_at,
    pj.has_custom_workflow,
    pj.manual_due_date::text,
    pj.batch_category,
    (pj.batch_category IS NOT NULL) as is_in_batch_processing,
    COALESCE(bi.is_batch_master, false) as is_batch_master,
    bi.batch_name,
    bi.constituent_job_count,
    pj.proof_approved_at
  FROM production_jobs pj
  LEFT JOIN categories c ON c.id = pj.category_id
  LEFT JOIN job_current_stages jcs ON jcs.job_id = pj.id
  LEFT JOIN batch_info bi ON bi.production_job_id = pj.id
  LEFT JOIN total_stats ts ON ts.job_id = pj.id
  LEFT JOIN user_permissions up ON up.job_id = pj.id
  LEFT JOIN profiles p ON p.id = jcs.started_by
  WHERE 
    (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND (p_stage_filter IS NULL OR jcs.stage_name = p_stage_filter)
    AND jcs.job_id IS NOT NULL  -- Only show jobs with accessible stages
  ORDER BY 
    CASE WHEN pj.status = 'Active' THEN 1 ELSE 2 END,
    pj.due_date ASC NULLS LAST,
    pj.created_at DESC;
END;
$function$;

-- Fix get_user_accessible_jobs_with_batch_allocation function as well
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(p_user_id uuid DEFAULT NULL::uuid, p_permission_type text DEFAULT 'work'::text, p_status_filter text DEFAULT NULL::text, p_stage_filter text DEFAULT NULL::text)
 RETURNS TABLE(job_id uuid, wo_no text, customer text, contact text, status text, due_date text, reference text, category_id uuid, category_name text, category_color text, current_stage_id uuid, current_stage_name text, current_stage_color text, current_stage_status text, user_can_view boolean, user_can_edit boolean, user_can_work boolean, user_can_manage boolean, workflow_progress numeric, total_stages integer, completed_stages integer, display_stage_name text, qty integer, started_by uuid, started_by_name text, proof_emailed_at timestamp with time zone, has_custom_workflow boolean, manual_due_date text, batch_category text, is_in_batch_processing boolean, is_batch_master boolean, batch_name text, constituent_job_count integer, effectiveduedate text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH user_stage_permissions AS (
    SELECT 
      ps.id as production_stage_id,
      BOOL_OR(ugsp.can_view) as can_view,
      BOOL_OR(ugsp.can_edit) as can_edit,
      BOOL_OR(ugsp.can_work) as can_work,
      BOOL_OR(ugsp.can_manage) as can_manage
    FROM public.user_group_stage_permissions ugsp
    INNER JOIN public.user_group_memberships ugm ON ugsp.user_group_id = ugm.group_id
    INNER JOIN public.production_stages ps ON ugsp.production_stage_id = ps.id
    WHERE ugm.user_id = p_user_id
      AND ps.is_active = true
    GROUP BY ps.id
  ),
  job_current_stages AS (
    SELECT DISTINCT ON (jsi.job_id)
      jsi.job_id,
      jsi.production_stage_id,
      jsi.status,
      jsi.started_by,
      jsi.proof_emailed_at,
      ps.name as stage_name,
      ps.color as stage_color
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    INNER JOIN user_stage_permissions usp ON jsi.production_stage_id = usp.production_stage_id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status IN ('active', 'pending')
      AND (
        CASE p_permission_type
          WHEN 'view' THEN usp.can_view
          WHEN 'edit' THEN usp.can_edit
          WHEN 'work' THEN usp.can_work
          WHEN 'manage' THEN usp.can_manage
          ELSE usp.can_work
        END
      ) = true
    ORDER BY jsi.job_id, 
      CASE WHEN jsi.status = 'active' THEN 1 
           WHEN jsi.status = 'pending' THEN 2 
           ELSE 3 END,
      jsi.stage_order ASC
  ),
  batch_info as (
    SELECT 
      bjr.production_job_id,
      b.name as batch_name,
      COUNT(*) OVER (PARTITION BY bjr.batch_id) as constituent_job_count,
      ROW_NUMBER() OVER (PARTITION BY bjr.batch_id ORDER BY bjr.created_at) = 1 as is_batch_master
    FROM batch_job_references bjr
    JOIN batches b ON bjr.batch_id = b.id
  )
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
    jcs.production_stage_id as current_stage_id,
    COALESCE(jcs.stage_name, 'No Stage') as current_stage_name,
    COALESCE(jcs.stage_color, '#6B7280') as current_stage_color,
    COALESCE(jcs.status, 'pending') as current_stage_status,
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
    COALESCE(jcs.stage_name, 'No Stage') as display_stage_name,
    pj.qty,
    jcs.started_by,
    COALESCE(p.full_name, 'Unknown') as started_by_name,
    jcs.proof_emailed_at,
    COALESCE(pj.has_custom_workflow, false) as has_custom_workflow,
    pj.manual_due_date::text,
    COALESCE(pj.batch_category, '') as batch_category,
    COALESCE(pj.batch_ready, false) as is_in_batch_processing,
    COALESCE(bi.is_batch_master, false) as is_batch_master,
    COALESCE(bi.batch_name, '') as batch_name,
    COALESCE(bi.constituent_job_count, 0) as constituent_job_count,
    COALESCE(
      pj.manual_due_date::text,
      pj.due_date::text
    ) as effectiveDueDate
  FROM production_jobs pj
  LEFT JOIN categories c ON pj.category_id = c.id
  LEFT JOIN job_current_stages jcs ON jcs.job_id = pj.id
  LEFT JOIN profiles p ON jcs.started_by = p.id
  LEFT JOIN batch_info bi ON bi.production_job_id = pj.id
  WHERE (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND (p_stage_filter IS NULL OR jcs.production_stage_id::text = p_stage_filter)
    AND jcs.job_id IS NOT NULL  -- Only show jobs with accessible stages
  ORDER BY pj.due_date ASC, pj.created_at DESC;
END;
$function$;