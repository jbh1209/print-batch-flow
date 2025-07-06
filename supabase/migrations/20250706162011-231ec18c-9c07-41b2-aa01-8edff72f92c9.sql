-- Fix Auto-Activation Issue - Jobs Should Stay Pending in Print Queues
-- Problem: Jobs are being automatically activated in print stages instead of waiting for operator

-- 1. Reset all auto-activated printing stages back to pending
UPDATE public.job_stage_instances
SET 
  status = 'pending',
  started_at = null,
  started_by = null,
  updated_at = now()
WHERE production_stage_id IN (
  SELECT id FROM public.production_stages 
  WHERE name ILIKE '%print%' 
  AND name ILIKE '%queue%'
)
AND status = 'active'
AND started_at IS NOT NULL;

-- 2. Fix the advance_job_stage function to NOT auto-activate next stages
CREATE OR REPLACE FUNCTION public.advance_job_stage(
  p_job_id UUID,
  p_job_table_name TEXT,
  p_current_stage_id UUID,
  p_completed_by UUID DEFAULT auth.uid(),
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_concurrent_group_id UUID;
  is_expedited BOOLEAN := false;
BEGIN
  -- Complete current stage
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

  -- Check if job is expedited
  IF p_job_table_name = 'production_jobs' THEN
    SELECT pj.is_expedited INTO is_expedited
    FROM public.production_jobs pj
    WHERE pj.id = p_job_id;
  END IF;

  -- DO NOT auto-activate next stages - leave them pending for operator action
  -- This was the problem - stages were being auto-activated
  
  RETURN TRUE;
END;
$$;