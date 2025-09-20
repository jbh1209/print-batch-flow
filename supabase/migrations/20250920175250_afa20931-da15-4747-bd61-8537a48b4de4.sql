-- Fix the get_user_accessible_jobs function to properly handle proof approval
-- When proof is approved, show the NEXT pending stage as current, not the proof stage

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
  p_user_id uuid DEFAULT NULL::uuid, 
  p_permission_type text DEFAULT 'work'::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_stage_filter text DEFAULT NULL::text
)
RETURNS TABLE(
  job_id uuid, wo_no text, customer text, contact text, status text, due_date text, 
  reference text, category_id uuid, category_name text, category_color text, 
  current_stage_id uuid, current_stage_name text, current_stage_color text, 
  current_stage_status text, user_can_view boolean, user_can_edit boolean, 
  user_can_work boolean, user_can_manage boolean, workflow_progress numeric, 
  total_stages integer, completed_stages integer, display_stage_name text, 
  qty integer, started_by uuid, started_by_name text, proof_emailed_at timestamp with time zone, 
  has_custom_workflow boolean, manual_due_date text, batch_category text, 
  is_in_batch_processing boolean, is_batch_master boolean, batch_name text, 
  constituent_job_count integer, effectiveduedate text, proof_approved_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH job_current_stages AS (
    -- CRITICAL FIX: When proof is approved, find the NEXT pending stage, not the proof stage
    SELECT DISTINCT ON (jsi.job_id)
      jsi.job_id,
      jsi.production_stage_id,
      jsi.status,
      jsi.started_by,
      jsi.proof_emailed_at,
      ps.name as stage_name,
      ps.color as stage_color,
      jsi.id as stage_instance_id
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.job_table_name = 'production_jobs'
      -- FIXED LOGIC: If proof is approved, skip completed proof stages and show next pending
      AND (
        (pj.proof_approved_at IS NULL AND jsi.status != 'completed') OR
        (pj.proof_approved_at IS NOT NULL AND jsi.status = 'pending')
      )
    ORDER BY jsi.job_id, 
      -- Prioritize active stages first, then pending stages by order
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
    pj.contact, -- ADDED: Include contact information
    pj.status,
    COALESCE(pj.manual_due_date::text, pj.due_date::text) as due_date,
    pj.reference,
    pj.category_id,
    COALESCE(cat.name, 'Uncategorized') as category_name,
    COALESCE(cat.color, '#6B7280') as category_color,
    jcs.production_stage_id as current_stage_id,
    COALESCE(jcs.stage_name, 'No Current Stage') as current_stage_name,
    COALESCE(jcs.stage_color, '#6B7280') as current_stage_color,
    COALESCE(jcs.status, 'pending') as current_stage_status,
    true as user_can_view,
    true as user_can_edit,
    true as user_can_work, 
    true as user_can_manage,
    CASE 
      WHEN pj.has_custom_workflow = true AND total_stats.total_stages > 0 THEN
        (total_stats.completed_stages::numeric / total_stats.total_stages::numeric * 100)
      ELSE 0
    END as workflow_progress,
    COALESCE(total_stats.total_stages, 0) as total_stages,
    COALESCE(total_stats.completed_stages, 0) as completed_stages,
    COALESCE(jcs.stage_name, 'No Current Stage') as display_stage_name,
    pj.qty,
    jcs.started_by,
    profiles.full_name as started_by_name,
    jcs.proof_emailed_at,
    pj.has_custom_workflow,
    pj.manual_due_date::text as manual_due_date,
    pj.batch_category,
    COALESCE(bi.batch_name IS NOT NULL, false) as is_in_batch_processing,
    COALESCE(bi.is_batch_master, false) as is_batch_master,
    bi.batch_name,
    COALESCE(bi.constituent_job_count, 0)::integer as constituent_job_count,
    COALESCE(pj.manual_due_date::text, pj.due_date::text) as effectiveduedate,
    pj.proof_approved_at -- ADDED: Include proof approval timestamp
  FROM production_jobs pj
  LEFT JOIN job_current_stages jcs ON pj.id = jcs.job_id
  LEFT JOIN categories cat ON pj.category_id = cat.id
  LEFT JOIN batch_info bi ON pj.id = bi.production_job_id
  LEFT JOIN profiles ON jcs.started_by = profiles.id
  LEFT JOIN (
    SELECT 
      job_id,
      COUNT(*) as total_stages,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_stages
    FROM job_stage_instances 
    WHERE job_table_name = 'production_jobs'
    GROUP BY job_id
  ) total_stats ON pj.id = total_stats.job_id
  WHERE pj.is_ready_for_production = true
    AND (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND (p_stage_filter IS NULL OR jcs.production_stage_id::text = p_stage_filter)
  ORDER BY 
    CASE WHEN jcs.status = 'active' THEN 1 ELSE 2 END,
    pj.due_date ASC NULLS LAST,
    pj.created_at DESC;
END;
$function$;