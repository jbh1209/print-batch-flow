-- Remove overloaded advance_job_stage signature to eliminate PostgREST ambiguity
DROP FUNCTION IF EXISTS public.advance_job_stage(uuid, text, uuid, text);

-- Ensure a single canonical implementation with completed_by default and expedite awareness
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