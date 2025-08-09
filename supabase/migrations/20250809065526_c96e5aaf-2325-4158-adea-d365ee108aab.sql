
CREATE OR REPLACE FUNCTION public.advance_parallel_job_stage(
  p_job_id uuid,
  p_job_table_name text,
  p_current_stage_id uuid,
  p_completed_by uuid DEFAULT auth.uid(),
  p_notes text DEFAULT NULL::text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_stage_record RECORD;
  v_actual_duration_minutes INTEGER;
  current_stage_order INTEGER;
  next_stage_records RECORD;
  is_proof_stage BOOLEAN := FALSE;
BEGIN
  -- Get the current stage instance details
  SELECT jsi.*, ps.name as stage_name
  INTO current_stage_record
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.production_stage_id = p_current_stage_id
    AND jsi.status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current stage not found or not active for job % stage %', p_job_id, p_current_stage_id;
  END IF;
  
  -- Calculate actual duration if stage was started
  IF current_stage_record.started_at IS NOT NULL THEN
    v_actual_duration_minutes := EXTRACT(EPOCH FROM (now() - current_stage_record.started_at)) / 60;
  END IF;
  
  -- Check if this is a proof stage
  is_proof_stage := current_stage_record.stage_name ILIKE '%proof%';
  
  -- Mark current stage as completed
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = COALESCE(p_completed_by, auth.uid()),
    actual_duration_minutes = v_actual_duration_minutes,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND production_stage_id = p_current_stage_id;
  
  -- If proof stage, update job status and trigger recalculation metadata
  IF is_proof_stage THEN
    UPDATE public.production_jobs 
    SET 
      proof_approved_at = now(),
      production_ready = true,
      last_queue_recalc_at = now(),
      updated_at = now()
    WHERE id = p_job_id;
  END IF;
  
  current_stage_order := current_stage_record.stage_order;
  
  -- Activate the next part-specific or sync-required stage(s)
  FOR next_stage_records IN
    SELECT DISTINCT
      jsi.id,
      jsi.production_stage_id,
      jsi.part_assignment,
      jsi.dependency_group,
      ps.name as stage_name,
      jsi.stage_order
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
    WHERE jsi.job_id = p_job_id 
      AND jsi.job_table_name = p_job_table_name
      AND jsi.stage_order > current_stage_order
      AND jsi.status = 'pending'
      AND (
        -- Part-matched (or universal) next stages advance immediately
        (current_stage_record.part_assignment = 'both'
          OR jsi.part_assignment = 'both'
          OR current_stage_record.part_assignment = jsi.part_assignment)
        OR
        -- Synchronization stages (with dependency group) advance when all prior deps are completed
        (jsi.dependency_group IS NOT NULL AND 
         (SELECT COUNT(*) FROM public.job_stage_instances sync_check
          WHERE sync_check.job_id = p_job_id 
            AND sync_check.job_table_name = p_job_table_name
            AND sync_check.dependency_group = jsi.dependency_group
            AND sync_check.stage_order < jsi.stage_order
            AND sync_check.status != 'completed') = 0)
      )
    ORDER BY jsi.stage_order ASC, jsi.created_at ASC
    LIMIT 25
  LOOP
    UPDATE public.job_stage_instances
    SET 
      status = 'active',
      started_at = now(),
      started_by = COALESCE(p_completed_by, auth.uid()),
      updated_at = now()
    WHERE id = next_stage_records.id;
    
    RAISE NOTICE 'Activated next stage: % (%) for part: % at order %', 
      next_stage_records.stage_name, 
      next_stage_records.production_stage_id,
      next_stage_records.part_assignment,
      next_stage_records.stage_order;
  END LOOP;
  
  -- If no more pending/active stages remain, mark job as completed
  IF NOT EXISTS (
    SELECT 1 FROM public.job_stage_instances
    WHERE job_id = p_job_id 
      AND job_table_name = p_job_table_name
      AND status IN ('pending', 'active')
  ) THEN
    UPDATE public.production_jobs
    SET 
      status = 'Completed',
      completed_at = now(),
      updated_at = now()
    WHERE id = p_job_id;
    
    RAISE NOTICE 'Job % completed - no more stages', p_job_id;
  END IF;
  
  RETURN TRUE;
END;
$function$;
