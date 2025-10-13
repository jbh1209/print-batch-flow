-- Fix type mismatch in get_user_accessible_jobs: cast workflow metrics to integer
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
  p_user_id uuid,
  p_permission_type text DEFAULT 'view'::text,
  p_status_filter text DEFAULT NULL::text,
  p_stage_filter text DEFAULT NULL::text
)
RETURNS TABLE(
  job_id uuid,
  wo_no text,
  customer text,
  status text,
  due_date timestamp with time zone,
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
  workflow_progress integer,
  total_stages integer,
  completed_stages integer,
  display_stage_name text,
  qty integer,
  started_by uuid,
  started_by_name text,
  proof_emailed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pj.id)
    pj.id AS job_id,
    pj.wo_no,
    pj.customer,
    pj.status,
    (pj.due_date)::timestamptz AS due_date,
    pj.reference,
    pj.category_id,
    cat.name AS category_name,
    cat.color AS category_color,
    jcs.stage_id AS current_stage_id,
    ps.name AS current_stage_name,
    ps.color AS current_stage_color,
    jcs.stage_status AS current_stage_status,
    TRUE AS user_can_view,
    TRUE AS user_can_edit,
    TRUE AS user_can_work,
    FALSE AS user_can_manage,
    COALESCE(wf.workflow_progress, 0) AS workflow_progress,
    COALESCE(wf.total_stages, 0) AS total_stages,
    COALESCE(wf.completed_stages, 0) AS completed_stages,
    COALESCE(ps.name, 'No Stage') AS display_stage_name,
    pj.qty,
    jcs.started_by,
    profiles.full_name AS started_by_name,
    jcs.proof_emailed_at
  FROM public.production_jobs pj
  LEFT JOIN public.categories cat ON pj.category_id = cat.id
  LEFT JOIN LATERAL (
    SELECT 
      jsi.production_stage_id AS stage_id,
      jsi.status AS stage_status,
      jsi.started_by,
      jsi.proof_emailed_at,
      jsi.stage_order
    FROM public.job_stage_instances jsi
    WHERE jsi.job_id = pj.id 
      AND jsi.job_table_name = 'production_jobs'
      AND jsi.status IN ('active', 'awaiting_approval', 'pending')
    ORDER BY 
      CASE WHEN jsi.status = 'active' THEN 1
           WHEN jsi.status = 'awaiting_approval' THEN 2
           WHEN jsi.status = 'pending' THEN 3
           ELSE 4 END,
      jsi.stage_order ASC
    LIMIT 1
  ) jcs ON TRUE
  LEFT JOIN public.production_stages ps ON jcs.stage_id = ps.id
  LEFT JOIN public.profiles ON jcs.started_by = profiles.id
  LEFT JOIN LATERAL (
    SELECT
      jsi.job_id,
      COALESCE(ROUND((COUNT(*) FILTER (WHERE jsi.status IN ('completed', 'skipped'))::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100)::int, 0) AS workflow_progress,
      COUNT(*)::int AS total_stages,
      (COUNT(*) FILTER (WHERE jsi.status IN ('completed', 'skipped')))::int AS completed_stages
    FROM public.job_stage_instances jsi
    WHERE jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
    GROUP BY jsi.job_id
  ) wf ON wf.job_id = pj.id
  WHERE (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND (p_stage_filter IS NULL OR jcs.stage_id = NULLIF(p_stage_filter, '')::uuid)
  ORDER BY pj.id, jcs.stage_order;
END;
$function$;