-- Emergency restoration: restore get_user_accessible_jobs with ORIGINAL 26-column signature

-- Drop the broken function
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(uuid, text, text, text);

-- Recreate with EXACT original 26-column signature that the codebase expects
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
  p_user_id uuid DEFAULT NULL,
  p_permission_type text DEFAULT 'work',
  p_status_filter text DEFAULT NULL,
  p_stage_filter text DEFAULT NULL
)
RETURNS TABLE(
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
  proof_emailed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Wrap the working function and SELECT only the 26 columns in correct order
  RETURN QUERY
  SELECT 
    t.job_id,
    t.wo_no,
    t.customer,
    t.contact,
    t.status,
    t.due_date,
    t.reference,
    t.category_id,
    t.category_name,
    t.category_color,
    t.current_stage_id,
    t.current_stage_name,
    t.current_stage_color,
    t.current_stage_status,
    t.user_can_view,
    t.user_can_edit,
    t.user_can_work,
    t.user_can_manage,
    t.workflow_progress,
    t.total_stages,
    t.completed_stages,
    t.display_stage_name,
    t.qty,
    t.started_by,
    t.started_by_name,
    t.proof_emailed_at
  FROM get_user_accessible_jobs_with_batch_allocation(
    p_user_id,
    p_permission_type,
    p_status_filter,
    p_stage_filter
  ) t;
END;
$$;