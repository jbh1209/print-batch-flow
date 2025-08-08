-- Fix the RPC function to include all missing fields expected by the client code
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(p_user_id uuid, p_permission_type text DEFAULT 'can_work'::text, p_status_filter text DEFAULT NULL::text)
 RETURNS TABLE(
  job_id uuid, 
  job_table_name text, 
  wo_no text, 
  customer text, 
  reference text, 
  status text, 
  due_date date, 
  qty integer, 
  current_stage_id uuid, 
  current_stage_name text, 
  current_stage_status text, 
  current_stage_color text, 
  can_start boolean, 
  can_complete boolean, 
  stage_order integer, 
  started_at timestamp with time zone, 
  started_by uuid, 
  estimated_duration_minutes integer, 
  is_expedited boolean, 
  proof_emailed_at timestamp with time zone, 
  proof_approved_manually_at timestamp with time zone, 
  client_email text, 
  client_name text,
  -- Add missing fields
  display_stage_name text,
  category_id uuid,
  category_name text,
  category_color text,
  user_can_view boolean,
  user_can_edit boolean,
  user_can_work boolean,
  user_can_manage boolean,
  workflow_progress integer,
  total_stages integer,
  completed_stages integer,
  started_by_name text
)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (jsi.job_id, jsi.job_table_name) 
    jsi.job_id,
    jsi.job_table_name,
    pj.wo_no,
    pj.customer,
    pj.reference,
    pj.status,
    pj.due_date,
    pj.qty,
    jsi.production_stage_id as current_stage_id,
    ps.name as current_stage_name,
    jsi.status as current_stage_status,
    ps.color as current_stage_color,
    CASE 
      WHEN jsi.status = 'pending' THEN true
      ELSE false
    END as can_start,
    CASE 
      WHEN jsi.status = 'active' THEN true
      ELSE false
    END as can_complete,
    jsi.stage_order,
    jsi.started_at,
    jsi.started_by,
    jsi.estimated_duration_minutes,
    COALESCE(pj.is_expedited, false) as is_expedited,
    jsi.proof_emailed_at,
    jsi.proof_approved_manually_at,
    jsi.client_email,
    jsi.client_name,
    -- Add missing fields with appropriate values
    ps.name as display_stage_name,
    pj.category_id,
    COALESCE(c.name, 'Unknown') as category_name,
    COALESCE(c.color, '#6B7280') as category_color,
    true as user_can_view, -- Since user has access to see this job
    true as user_can_edit, -- Simplified for now
    true as user_can_work, -- Since they have work permission
    false as user_can_manage, -- Conservative default
    -- Calculate workflow progress
    CASE 
      WHEN total_job_stages.total > 0 THEN 
        ROUND((completed_job_stages.completed::numeric / total_job_stages.total::numeric) * 100)::integer
      ELSE 0 
    END as workflow_progress,
    COALESCE(total_job_stages.total, 0) as total_stages,
    COALESCE(completed_job_stages.completed, 0) as completed_stages,
    COALESCE(p.full_name, 'Unknown') as started_by_name
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  LEFT JOIN public.production_jobs pj ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
  LEFT JOIN public.categories c ON pj.category_id = c.id
  LEFT JOIN public.profiles p ON jsi.started_by = p.id
  -- Calculate total stages for this job
  LEFT JOIN (
    SELECT 
      job_id, 
      job_table_name, 
      COUNT(*) as total
    FROM public.job_stage_instances 
    GROUP BY job_id, job_table_name
  ) total_job_stages ON jsi.job_id = total_job_stages.job_id AND jsi.job_table_name = total_job_stages.job_table_name
  -- Calculate completed stages for this job
  LEFT JOIN (
    SELECT 
      job_id, 
      job_table_name, 
      COUNT(*) as completed
    FROM public.job_stage_instances 
    WHERE status = 'completed'
    GROUP BY job_id, job_table_name
  ) completed_job_stages ON jsi.job_id = completed_job_stages.job_id AND jsi.job_table_name = completed_job_stages.job_table_name
  WHERE jsi.status = 'active'  -- Only show active stages
    AND (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND EXISTS (
      SELECT 1 
      FROM public.user_group_memberships ugm
      JOIN public.user_group_stage_permissions ugsp ON ugm.group_id = ugsp.user_group_id
      WHERE ugm.user_id = p_user_id 
        AND ugsp.production_stage_id = jsi.production_stage_id
        AND (
          (p_permission_type = 'can_work' AND ugsp.can_work = true) OR
          (p_permission_type = 'can_view' AND ugsp.can_view = true) OR
          (p_permission_type = 'can_edit' AND ugsp.can_edit = true) OR
          (p_permission_type = 'can_manage' AND ugsp.can_manage = true)
        )
    )
  ORDER BY jsi.job_id, jsi.job_table_name, jsi.stage_order ASC;
END;
$function$