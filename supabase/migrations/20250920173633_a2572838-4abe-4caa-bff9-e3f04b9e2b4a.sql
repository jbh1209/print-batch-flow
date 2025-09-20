-- Update get_user_accessible_jobs function to return both proof_emailed_at and proof_approved_at
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
    p_user_id uuid DEFAULT NULL,
    p_permission_type text DEFAULT 'work',
    p_status_filter text DEFAULT NULL,
    p_stage_filter text DEFAULT NULL
)
RETURNS TABLE (
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
    proof_emailed_at timestamp with time zone,
    proof_approved_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  latest_started_by AS (
    -- Get the most recent started_by information for each job
    SELECT DISTINCT ON (jsi.job_id)
      jsi.job_id,
      jsi.started_by,
      p.full_name as started_by_name
    FROM job_stage_instances jsi
    LEFT JOIN profiles p ON p.id = jsi.started_by
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.started_by IS NOT NULL
    ORDER BY jsi.job_id, jsi.started_at DESC NULLS LAST
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
      (SELECT COUNT(*)::numeric * 100.0 / NULLIF(COUNT(*), 0)
       FROM job_stage_instances jsi_inner
       WHERE jsi_inner.job_id = pj.id 
         AND jsi_inner.job_table_name = 'production_jobs'
         AND jsi_inner.status = 'completed'),
      0
    ) as workflow_progress,
    COALESCE(
      (SELECT COUNT(*)::integer
       FROM job_stage_instances jsi_inner
       WHERE jsi_inner.job_id = pj.id 
         AND jsi_inner.job_table_name = 'production_jobs'),
      0
    ) as total_stages,
    COALESCE(
      (SELECT COUNT(*)::integer
       FROM job_stage_instances jsi_inner
       WHERE jsi_inner.job_id = pj.id 
         AND jsi_inner.job_table_name = 'production_jobs'
         AND jsi_inner.status = 'completed'),
      0
    ) as completed_stages,
    COALESCE(jcs.stage_name, 'No Stage') as display_stage_name,
    COALESCE(pj.qty, 0) as qty,
    lsb.started_by,
    lsb.started_by_name,
    jcs.proof_emailed_at as proof_emailed_at,
    pj.proof_approved_at as proof_approved_at
  FROM production_jobs pj
  LEFT JOIN categories c ON c.id = pj.category_id
  LEFT JOIN job_current_stages jcs ON jcs.job_id = pj.id
  LEFT JOIN latest_started_by lsb ON lsb.job_id = pj.id
  WHERE (p_status_filter IS NULL OR pj.status = p_status_filter)
  ORDER BY pj.wo_no;
END;
$$;