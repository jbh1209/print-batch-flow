-- Create isolated function for dashboard job stats
-- This function is specifically for the TrackerDashboard and does NOT affect
-- existing worker queue or production functionality

CREATE OR REPLACE FUNCTION get_dashboard_job_stats(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  wo_no text,
  customer text,
  status text,
  due_date text,
  proof_approved_at timestamp with time zone,
  current_stage_name text,
  current_stage_status text,
  current_stage_color text,
  display_stage_name text,
  workflow_progress numeric,
  category text,
  category_color text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Simple permission check: user must have 'manage' permission on at least one stage
  -- Dashboard is admin-only anyway
  IF NOT EXISTS (
    SELECT 1 FROM user_stage_permissions 
    WHERE user_id = p_user_id 
    AND permission_type = 'manage'
  ) THEN
    RETURN;
  END IF;

  -- Return ALL jobs including completed ones
  -- This is specifically for dashboard stats display
  RETURN QUERY
  WITH current_stages AS (
    SELECT DISTINCT ON (jsi.job_id)
      jsi.job_id,
      jsi.production_stage_id,
      jsi.status as stage_status,
      ps.name as stage_name,
      ps.color as stage_color,
      jsi.stage_order
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.status IN ('pending', 'active', 'awaiting_approval', 'changes_requested')
    ORDER BY jsi.job_id, jsi.stage_order DESC, jsi.created_at DESC
  ),
  workflow_stats AS (
    SELECT 
      jsi.job_id,
      COUNT(*) FILTER (WHERE jsi.status = 'completed') * 100.0 / NULLIF(COUNT(*), 0) as progress
    FROM job_stage_instances jsi
    GROUP BY jsi.job_id
  )
  SELECT 
    pj.id,
    pj.wo_no,
    pj.customer,
    COALESCE(pj.status, 'Unknown') as status,
    pj.due_date,
    pj.proof_approved_at,
    COALESCE(cs.stage_name, 'Not Started') as current_stage_name,
    COALESCE(cs.stage_status, 'pending') as current_stage_status,
    COALESCE(cs.stage_color, '#6B7280') as current_stage_color,
    COALESCE(cs.stage_name, 'Not Started') as display_stage_name,
    COALESCE(ws.progress, 0) as workflow_progress,
    c.name as category,
    c.color as category_color
  FROM production_jobs pj
  LEFT JOIN current_stages cs ON cs.job_id = pj.id
  LEFT JOIN workflow_stats ws ON ws.job_id = pj.id
  LEFT JOIN categories c ON c.id = pj.category_id
  ORDER BY pj.due_date ASC NULLS LAST, pj.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_dashboard_job_stats(uuid) TO authenticated;