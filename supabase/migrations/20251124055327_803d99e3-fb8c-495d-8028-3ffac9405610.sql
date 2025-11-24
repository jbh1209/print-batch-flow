-- Fix get_user_accessible_jobs signature to match code expectations
-- Drop the 2-parameter version created in the previous migration
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(text, text);

-- Recreate with the correct 4-parameter signature that the code expects
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
  p_user_id uuid DEFAULT NULL,
  p_permission_type text DEFAULT 'work',
  p_status_filter text DEFAULT NULL,
  p_stage_filter text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  wo_no text,
  customer text,
  reference text,
  status text,
  due_date timestamp with time zone,
  tentative_due_date timestamp with time zone,
  proof_approved_at timestamp with time zone,
  category text,
  current_stage text,
  workflow_progress integer,
  is_batch_master boolean,
  batch_category text,
  stages jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use auth.uid() for security instead of relying on passed user_id
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
          'completed_at', jsi.completed_at
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
  WHERE (p_status_filter IS NULL OR pj.status = p_status_filter)
  ORDER BY pj.due_date NULLS LAST, pj.created_at DESC;
END;
$$;