-- Emergency rollback: restore get_user_accessible_jobs by wrapping the working function

-- Drop the broken function I created
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(uuid, text, text, text);

-- Create wrapper that calls the working get_user_accessible_jobs_with_batch_allocation function
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
  contact text,
  reference text,
  status text,
  due_date text,
  tentative_due_date text,
  proof_approved_at timestamp with time zone,
  category text,
  qty integer,
  size text,
  specification text,
  current_stage text,
  current_stage_id uuid,
  current_stage_status text,
  current_stage_started_at timestamp with time zone,
  workflow_progress integer,
  is_expedited boolean,
  expedite_reason text,
  is_batch_master boolean,
  batch_category text,
  batch_allocated_at timestamp with time zone,
  batch_ready boolean,
  highlighted boolean,
  location text,
  user_permission text,
  stages jsonb,
  date text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  qr_code_url text,
  qr_code_data text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Simply wrap the working function
  RETURN QUERY
  SELECT *
  FROM get_user_accessible_jobs_with_batch_allocation(
    p_user_id,
    p_permission_type,
    p_status_filter,
    p_stage_filter
  );
END;
$$;