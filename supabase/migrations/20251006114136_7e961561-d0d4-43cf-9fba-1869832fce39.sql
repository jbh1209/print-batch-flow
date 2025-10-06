-- Phase 5: Fix job visibility for awaiting_approval status and admin permissions

-- Drop the existing function with exact signature
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(p_user_id uuid, p_permission_type text, p_status_filter text, p_stage_filter text);

-- Recreate with fixes for awaiting_approval visibility and admin permissions
CREATE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(
  p_user_id uuid DEFAULT NULL::uuid,
  p_permission_type text DEFAULT 'work'::text,
  p_status_filter text DEFAULT NULL::text,
  p_stage_filter uuid DEFAULT NULL::uuid
)
RETURNS TABLE (
  job_id uuid,
  wo_no text,
  job_name text,
  category_id uuid,
  category_name text,
  current_stage_id uuid,
  current_stage_name text,
  current_stage_status text,
  stage_order integer,
  job_status text,
  due_date date,
  created_at timestamptz,
  updated_at timestamptz,
  is_batch_master boolean,
  batch_size integer,
  proof_emailed_at timestamptz,
  proof_approved_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pj.id)
    pj.id as job_id,
    pj.wo_no,
    pj.job_name,
    pj.category_id,
    c.name as category_name,
    jsi.production_stage_id as current_stage_id,
    ps.name as current_stage_name,
    jsi.status as current_stage_status,
    jsi.stage_order,
    pj.status as job_status,
    pj.due_date,
    pj.created_at,
    pj.updated_at,
    pj.is_batch_master,
    pj.batch_size,
    jsi.proof_emailed_at,
    pj.proof_approved_at
  FROM production_jobs pj
  INNER JOIN job_stage_instances jsi ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
  INNER JOIN production_stages ps ON ps.id = jsi.production_stage_id
  LEFT JOIN categories c ON c.id = pj.category_id
  INNER JOIN user_stage_permissions usp ON usp.production_stage_id = jsi.production_stage_id AND usp.user_id = p_user_id
  WHERE pj.proof_approved_at IS NOT NULL
    -- CRITICAL FIX: Include awaiting_approval status for proof workflow visibility
    AND jsi.status IN ('active', 'pending', 'awaiting_approval')
    AND (p_status_filter IS NULL OR jsi.status = p_status_filter)
    AND (p_stage_filter IS NULL OR jsi.production_stage_id = p_stage_filter)
    -- CRITICAL FIX: Respect can_manage permission for admin users
    AND (
      CASE p_permission_type
        WHEN 'view' THEN (usp.can_view OR usp.can_manage)
        WHEN 'edit' THEN (usp.can_edit OR usp.can_manage)
        WHEN 'work' THEN (usp.can_work OR usp.can_manage)
        WHEN 'manage' THEN usp.can_manage
        ELSE (usp.can_work OR usp.can_manage)
      END
    ) = true
  ORDER BY pj.id, jsi.stage_order ASC;
END;
$$;

COMMENT ON FUNCTION public.get_user_accessible_jobs_with_batch_allocation IS 
'Returns jobs accessible to user with proper handling of awaiting_approval status and admin can_manage permissions. Used for DTP dashboard and production views.';