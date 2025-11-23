-- Fix get_user_accessible_jobs RPC function to correctly calculate workflow progress and current stage
CREATE OR REPLACE FUNCTION get_user_accessible_jobs(
  permission_type TEXT DEFAULT NULL,
  status_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  wo_no TEXT,
  customer TEXT,
  reference TEXT,
  qty INTEGER,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT,
  category TEXT,
  category_id UUID,
  proof_approved_at TIMESTAMP WITH TIME ZONE,
  current_stage_id UUID,
  current_stage_name TEXT,
  current_stage_status TEXT,
  current_stage_order INTEGER,
  workflow_progress NUMERIC,
  is_batch_master BOOLEAN,
  batch_category TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pj.id,
    pj.wo_no,
    pj.customer,
    pj.reference,
    pj.qty,
    pj.due_date,
    pj.status,
    pj.category,
    pj.category_id,
    pj.proof_approved_at,
    jsi.production_stage_id as current_stage_id,
    ps.name as current_stage_name,
    jsi.status as current_stage_status,
    jsi.stage_order as current_stage_order,
    -- Correct workflow_progress calculation
    CASE 
      WHEN (SELECT COUNT(*) FROM job_stage_instances WHERE job_id = pj.id AND job_table_name = 'production_jobs') = 0 THEN 0
      ELSE ROUND(
        (SELECT COUNT(*)::numeric FROM job_stage_instances WHERE job_id = pj.id AND job_table_name = 'production_jobs' AND status = 'completed') * 100.0 /
        (SELECT COUNT(*) FROM job_stage_instances WHERE job_id = pj.id AND job_table_name = 'production_jobs')
      )
    END as workflow_progress,
    pj.is_batch_master,
    pj.batch_category,
    pj.created_at,
    pj.updated_at
  FROM production_jobs pj
  -- Get current stage: first pending/active/scheduled, or last completed if all done
  LEFT JOIN LATERAL (
    SELECT * FROM job_stage_instances jsi_inner
    WHERE jsi_inner.job_id = pj.id AND jsi_inner.job_table_name = 'production_jobs'
    ORDER BY 
      CASE 
        WHEN jsi_inner.status IN ('active', 'pending', 'scheduled') THEN 0
        WHEN jsi_inner.status = 'completed' THEN 1
        ELSE 2
      END,
      jsi_inner.stage_order ASC
    LIMIT 1
  ) jsi ON true
  LEFT JOIN production_stages ps ON jsi.production_stage_id = ps.id
  WHERE auth.uid() IS NOT NULL
  ORDER BY pj.due_date ASC NULLS LAST, pj.created_at DESC;
END;
$$;