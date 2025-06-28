
-- Add expedite fields to production_jobs table
ALTER TABLE public.production_jobs 
ADD COLUMN is_expedited boolean DEFAULT false,
ADD COLUMN expedited_at timestamp with time zone,
ADD COLUMN expedited_by uuid,
ADD COLUMN expedite_reason text;

-- Create index for better performance when filtering expedited jobs
CREATE INDEX idx_production_jobs_expedited ON public.production_jobs(is_expedited, expedited_at) WHERE is_expedited = true;

-- Create function to expedite a job throughout the factory
CREATE OR REPLACE FUNCTION public.expedite_job_factory_wide(
  p_job_id uuid,
  p_expedite_reason text,
  p_expedited_by uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Update the production job to mark as expedited
  UPDATE public.production_jobs
  SET 
    is_expedited = true,
    expedited_at = now(),
    expedited_by = p_expedited_by,
    expedite_reason = p_expedite_reason,
    updated_at = now()
  WHERE id = p_job_id;

  -- Set all current and future stage instances to expedite order (0)
  UPDATE public.job_stage_instances
  SET 
    job_order_in_stage = 0,
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = 'production_jobs';

  RETURN true;
END;
$function$;

-- Create function to remove expedite status
CREATE OR REPLACE FUNCTION public.remove_job_expedite_status(
  p_job_id uuid,
  p_removed_by uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Remove expedite status from production job  
  UPDATE public.production_jobs
  SET 
    is_expedited = false,
    expedited_at = null,
    expedited_by = null,
    expedite_reason = null,
    updated_at = now()
  WHERE id = p_job_id;

  -- Reset job order in stages to default (will be recalculated by ordering service)
  UPDATE public.job_stage_instances
  SET 
    job_order_in_stage = 1,
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = 'production_jobs'
    AND job_order_in_stage = 0;

  RETURN true;
END;
$function$;

-- Update the advance_job_stage function to maintain expedite ordering
CREATE OR REPLACE FUNCTION public.advance_job_stage(
  p_job_id uuid, 
  p_job_table_name text, 
  p_current_stage_id uuid, 
  p_completed_by uuid DEFAULT auth.uid(), 
  p_notes text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  is_job_expedited boolean := false;
BEGIN
  -- Check if job is expedited
  SELECT is_expedited INTO is_job_expedited
  FROM public.production_jobs
  WHERE id = p_job_id;

  -- Complete the current stage
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = p_completed_by,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND production_stage_id = p_current_stage_id
    AND status = 'active';

  -- If job is expedited, ensure next pending stage gets expedite ordering
  IF is_job_expedited THEN
    UPDATE public.job_stage_instances
    SET 
      job_order_in_stage = 0,
      updated_at = now()
    WHERE job_id = p_job_id 
      AND job_table_name = p_job_table_name
      AND status = 'pending'
      AND stage_order = (
        SELECT MIN(stage_order)
        FROM public.job_stage_instances
        WHERE job_id = p_job_id 
          AND job_table_name = p_job_table_name
          AND status = 'pending'
      );
  END IF;

  RETURN TRUE;
END;
$function$;
