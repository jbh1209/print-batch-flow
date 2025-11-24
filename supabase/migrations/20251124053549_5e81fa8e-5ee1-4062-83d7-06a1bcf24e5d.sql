-- ============================================================
-- FIX: Drop all overloaded versions of get_user_accessible_jobs and recreate correctly
-- ============================================================

-- Drop all existing overloaded versions explicitly
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(uuid, text, text, text) CASCADE;

-- Create the single correct version
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
  permission_type text DEFAULT NULL,
  status_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  wo_no text,
  customer text,
  reference text,
  status text,
  due_date timestamptz,
  tentative_due_date timestamptz,
  proof_approved_at timestamptz,
  category text,
  current_stage text,
  workflow_progress integer,
  is_batch_master boolean,
  batch_category text,
  stages jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Basic authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH job_stages AS (
    SELECT 
      jsi.job_id,
      jsonb_agg(
        jsonb_build_object(
          'id', jsi.id,
          'stage_name', ps.name,
          'status', jsi.status,
          'stage_order', jsi.stage_order,
          'started_at', jsi.started_at,
          'completed_at', jsi.completed_at,
          'machine_type', ps.machine_type,
          'allows_parallel_processing', ps.allows_parallel_processing
        ) ORDER BY jsi.stage_order
      ) as stages_json,
      COUNT(*) FILTER (WHERE jsi.status = 'completed') as completed_count,
      COUNT(*) as total_count,
      -- Get current stage: first pending/active/scheduled, or last completed if all done
      (
        SELECT ps2.name
        FROM job_stage_instances jsi2
        JOIN production_stages ps2 ON jsi2.production_stage_id = ps2.id
        WHERE jsi2.job_id = jsi.job_id
          AND jsi2.status IN ('pending', 'active', 'scheduled')
        ORDER BY jsi2.stage_order
        LIMIT 1
      ) as current_stage_pending,
      (
        SELECT ps3.name
        FROM job_stage_instances jsi3
        JOIN production_stages ps3 ON jsi3.production_stage_id = ps3.id
        WHERE jsi3.job_id = jsi.job_id
          AND jsi3.status = 'completed'
        ORDER BY jsi3.stage_order DESC
        LIMIT 1
      ) as last_completed_stage
    FROM job_stage_instances jsi
    JOIN production_stages ps ON jsi.production_stage_id = ps.id
    WHERE jsi.job_table_name = 'production_jobs'
    GROUP BY jsi.job_id
  )
  SELECT 
    pj.id,
    pj.wo_no,
    pj.customer,
    pj.reference,
    pj.status,
    pj.due_date,
    pj.tentative_due_date,
    pj.proof_approved_at,
    pj.category,
    COALESCE(js.current_stage_pending, js.last_completed_stage, 'No Stage') as current_stage,
    ROUND((js.completed_count::numeric / NULLIF(js.total_count, 0)::numeric * 100))::integer as workflow_progress,
    pj.is_batch_master,
    pj.batch_category,
    js.stages_json as stages
  FROM production_jobs pj
  LEFT JOIN job_stages js ON pj.id = js.job_id
  WHERE (status_filter IS NULL OR pj.status = status_filter)
  ORDER BY pj.due_date NULLS LAST, pj.created_at DESC;
END;
$$;