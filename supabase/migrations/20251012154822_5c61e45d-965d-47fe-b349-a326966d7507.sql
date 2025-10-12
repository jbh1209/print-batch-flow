-- Fix rework_job_stage function to accept stage_instance_id instead of production_stage_id
-- This fixes the "Request Changes" workflow that was failing with error P0001

-- Drop the old function first (required when changing parameter names)
DROP FUNCTION IF EXISTS public.rework_job_stage(uuid, text, uuid, uuid, text, uuid);

-- Recreate with corrected signature
CREATE FUNCTION public.rework_job_stage(
  p_job_id uuid, 
  p_job_table_name text, 
  p_current_stage_instance_id uuid,  -- Changed from p_current_stage_id to be specific instance
  p_target_stage_id uuid,            -- Keep as-is (production_stage_id for target stage type)
  p_rework_reason text DEFAULT NULL::text, 
  p_reworked_by uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_stage_order INTEGER;
  target_stage_order INTEGER;
BEGIN
  -- Get the order of the current stage instance (using stage instance ID)
  SELECT stage_order INTO current_stage_order
  FROM public.job_stage_instances
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND id = p_current_stage_instance_id;  -- ✅ Use stage instance ID

  -- Get the order of the target stage (by production_stage_id is correct here)
  SELECT stage_order INTO target_stage_order
  FROM public.job_stage_instances
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND production_stage_id = p_target_stage_id;

  -- Validate that target stage comes before current stage
  IF target_stage_order >= current_stage_order THEN
    RETURN FALSE;
  END IF;

  -- Mark current stage as reworked (using stage instance ID)
  UPDATE public.job_stage_instances
  SET 
    status = 'reworked',
    completed_at = null,
    completed_by = null,
    rework_count = rework_count + 1,
    rework_reason = p_rework_reason,
    is_rework = true,
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND id = p_current_stage_instance_id;  -- ✅ Use stage instance ID

  -- Reset any stages between target and current to pending
  UPDATE public.job_stage_instances
  SET 
    status = 'pending',
    started_at = null,
    completed_at = null,
    started_by = null,
    completed_by = null,
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND stage_order > target_stage_order 
    AND stage_order < current_stage_order;

  -- Reactivate the target stage (by production_stage_id is correct here)
  UPDATE public.job_stage_instances
  SET 
    status = 'active',
    started_at = now(),
    started_by = p_reworked_by,
    completed_at = null,
    completed_by = null,
    is_rework = true,
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND production_stage_id = p_target_stage_id;

  RETURN TRUE;
END;
$function$;