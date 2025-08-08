-- Replace the broken advance_job_stage function with complete working logic
CREATE OR REPLACE FUNCTION public.advance_job_stage(
  p_job_id uuid,
  p_job_table_name text,
  p_current_stage_id uuid,
  p_notes text DEFAULT NULL,
  p_completed_by uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stage_record RECORD;
  next_stage_record RECORD;
  actual_duration_minutes INTEGER;
  is_proof_stage BOOLEAN := FALSE;
BEGIN
  -- Get current stage instance details
  SELECT 
    jsi.*,
    ps.name as stage_name
  INTO current_stage_record
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.production_stage_id = p_current_stage_id
    AND jsi.status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active stage not found for job % and stage %', p_job_id, p_current_stage_id;
  END IF;
  
  -- Calculate actual duration if started
  IF current_stage_record.started_at IS NOT NULL THEN
    actual_duration_minutes := EXTRACT(EPOCH FROM (now() - current_stage_record.started_at)) / 60;
  END IF;
  
  -- Check if this is a proof stage
  is_proof_stage := current_stage_record.stage_name ILIKE '%proof%';
  
  -- Mark current stage as completed
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = p_completed_by,
    actual_duration_minutes = actual_duration_minutes,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND production_stage_id = p_current_stage_id;
  
  -- If proof stage, update job status and trigger recalculation
  IF is_proof_stage THEN
    UPDATE public.production_jobs 
    SET 
      proof_approved_at = now(),
      production_ready = true,
      last_queue_recalc_at = now(),
      updated_at = now()
    WHERE id = p_job_id;
  END IF;
  
  -- Find and activate the next pending stage in workflow order
  SELECT 
    jsi.id,
    jsi.production_stage_id,
    ps.name as stage_name,
    jsi.stage_order
  INTO next_stage_record
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.status = 'pending'
    AND jsi.stage_order > current_stage_record.stage_order
  ORDER BY jsi.stage_order ASC
  LIMIT 1;
  
  -- Activate the next stage if found
  IF next_stage_record.id IS NOT NULL THEN
    UPDATE public.job_stage_instances
    SET 
      status = 'active',
      started_at = now(),
      started_by = p_completed_by,
      updated_at = now()
    WHERE id = next_stage_record.id;
    
    RAISE NOTICE 'Advanced job % from % to %', 
      p_job_id, current_stage_record.stage_name, next_stage_record.stage_name;
  ELSE
    -- No more stages - mark job as completed
    UPDATE public.production_jobs
    SET 
      status = 'Completed',
      completed_at = now(),
      updated_at = now()
    WHERE id = p_job_id;
    
    RAISE NOTICE 'Job % completed - no more stages', p_job_id;
  END IF;
  
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to advance job stage: %', SQLERRM;
END;
$$;