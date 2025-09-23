-- Drop and recreate the function with the new return type
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(uuid,text,text,text);

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(
  p_user_id uuid DEFAULT NULL::uuid, 
  p_permission_type text DEFAULT 'work'::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_stage_filter text DEFAULT NULL::text
)
RETURNS TABLE(
  job_id uuid, wo_no text, customer text, contact text, status text, 
  due_date text, original_committed_due_date text, reference text, 
  category_id uuid, category_name text, category_color text, 
  current_stage_id uuid, current_stage_name text, current_stage_color text, 
  current_stage_status text, user_can_view boolean, user_can_edit boolean, 
  user_can_work boolean, user_can_manage boolean, workflow_progress numeric, 
  total_stages integer, completed_stages integer, display_stage_name text, 
  qty integer, started_by uuid, started_by_name text, 
  proof_emailed_at timestamp with time zone, has_custom_workflow boolean, 
  manual_due_date text, batch_category text, is_in_batch_processing boolean, 
  is_batch_master boolean, batch_name text, constituent_job_count integer, 
  effectiveduedate text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH job_current_stages AS (
    -- Get the most relevant current stage for each job (prioritize active over pending)
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
    WHERE jsi.job_table_name = 'production_jobs'
    ORDER BY jsi.job_id, 
      CASE WHEN jsi.status = 'active' THEN 1 
           WHEN jsi.status = 'pending' THEN 2 
           ELSE 3 END,
      jsi.stage_order ASC
  ),
  job_stage_counts AS (
    -- Calculate workflow progress for each job
    SELECT 
      jsi.job_id,
      COUNT(*) as total_stages,
      COUNT(CASE WHEN jsi.status = 'completed' THEN 1 END) as completed_stages,
      ROUND(
        (COUNT(CASE WHEN jsi.status = 'completed' THEN 1 END)::numeric / 
         NULLIF(COUNT(*)::numeric, 0)) * 100, 1
      ) as workflow_progress
    FROM job_stage_instances jsi
    WHERE jsi.job_table_name = 'production_jobs'
    GROUP BY jsi.job_id
  ),
  batch_info AS (
    -- Get batch information for jobs
    SELECT 
      bjr.production_job_id as job_id,
      b.name as batch_name,
      COUNT(*) OVER (PARTITION BY bjr.batch_id) as constituent_job_count,
      CASE WHEN bjr.production_job_id = (
        SELECT MIN(bjr2.production_job_id) 
        FROM batch_job_references bjr2 
        WHERE bjr2.batch_id = bjr.batch_id
      ) THEN true ELSE false END as is_batch_master
    FROM batch_job_references bjr
    JOIN batches b ON b.id = bjr.batch_id
  )
  SELECT 
    pj.id::uuid as job_id,
    pj.wo_no::text,
    COALESCE(pj.customer, '')::text as customer,
    COALESCE(pj.contact, '')::text as contact,
    pj.status::text,
    COALESCE(pj.due_date::text, '') as due_date,
    COALESCE(pj.original_committed_due_date::text, '') as original_committed_due_date,
    COALESCE(pj.reference, '')::text as reference,
    pj.category::uuid as category_id,
    COALESCE(c.name, 'Uncategorized')::text as category_name,
    COALESCE(c.color, '#6B7280')::text as category_color,
    jcs.production_stage_id::uuid as current_stage_id,
    COALESCE(jcs.stage_name, 'No Current Stage')::text as current_stage_name,
    COALESCE(jcs.stage_color, '#6B7280')::text as current_stage_color,
    COALESCE(jcs.status, 'pending')::text as current_stage_status,
    true as user_can_view,
    true as user_can_edit, 
    true as user_can_work,
    true as user_can_manage,
    COALESCE(jsc.workflow_progress, 0)::numeric as workflow_progress,
    COALESCE(jsc.total_stages, 0)::integer as total_stages,
    COALESCE(jsc.completed_stages, 0)::integer as completed_stages,
    CASE 
      WHEN pj.is_in_batch_processing = true THEN 'In Batch Processing'
      ELSE COALESCE(jcs.stage_name, 'No Current Stage')
    END::text as display_stage_name,
    pj.qty::integer,
    jcs.started_by::uuid,
    COALESCE(prof.display_name, 'System')::text as started_by_name,
    jcs.proof_emailed_at,
    COALESCE(pj.has_custom_workflow, false) as has_custom_workflow,
    COALESCE(pj.manual_due_date::text, '') as manual_due_date,
    COALESCE(pj.batch_category, '')::text as batch_category,
    COALESCE(pj.is_in_batch_processing, false) as is_in_batch_processing,
    COALESCE(bi.is_batch_master, false) as is_batch_master,
    COALESCE(bi.batch_name, '')::text as batch_name,
    COALESCE(bi.constituent_job_count, 0)::integer as constituent_job_count,
    COALESCE(pj.due_date::text, '') as effectiveduedate
  FROM production_jobs pj
  LEFT JOIN categories c ON c.id = pj.category
  LEFT JOIN job_current_stages jcs ON jcs.job_id = pj.id
  LEFT JOIN job_stage_counts jsc ON jsc.job_id = pj.id
  LEFT JOIN batch_info bi ON bi.job_id = pj.id
  LEFT JOIN profiles prof ON prof.user_id = jcs.started_by
  WHERE 
    (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND (p_stage_filter IS NULL OR jcs.production_stage_id::text = p_stage_filter OR 
         (p_stage_filter = 'batch_processing' AND pj.is_in_batch_processing = true))
  ORDER BY 
    CASE 
      WHEN pj.due_date IS NOT NULL THEN pj.due_date
      ELSE '2099-12-31'::timestamp with time zone
    END ASC,
    pj.created_at DESC;
END;
$function$;