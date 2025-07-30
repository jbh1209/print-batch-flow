-- Create function to check if all stages in a dependency group are completed
CREATE OR REPLACE FUNCTION public.check_dependency_completion(
  p_job_id uuid, 
  p_job_table_name text, 
  p_dependency_group uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  total_stages INTEGER;
  completed_stages INTEGER;
BEGIN
  -- If no dependency group specified, consider it completed
  IF p_dependency_group IS NULL THEN
    RETURN true;
  END IF;
  
  -- Count total stages in the dependency group
  SELECT COUNT(*) INTO total_stages
  FROM public.job_stage_instances
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND dependency_group = p_dependency_group;
  
  -- Count completed stages in the dependency group
  SELECT COUNT(*) INTO completed_stages
  FROM public.job_stage_instances
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND dependency_group = p_dependency_group
    AND status = 'completed';
  
  -- Return true only if all stages in the group are completed
  RETURN (total_stages > 0 AND completed_stages = total_stages);
END;
$function$

-- Update the advance_job_stage function to handle parallel processing correctly
CREATE OR REPLACE FUNCTION public.advance_job_stage_with_parallel_support(
  p_job_id uuid, 
  p_job_table_name text, 
  p_current_stage_id uuid, 
  p_notes text DEFAULT NULL::text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_stage_record RECORD;
  next_stage_record RECORD;
  actual_duration_minutes INTEGER;
BEGIN
  -- Get the current stage instance with dependency info
  SELECT jsi.*, ps.name as stage_name INTO current_stage_record
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.production_stage_id = p_current_stage_id
    AND jsi.status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current stage not found or not active';
  END IF;
  
  -- Calculate actual duration if stage was started
  IF current_stage_record.started_at IS NOT NULL THEN
    actual_duration_minutes := EXTRACT(EPOCH FROM (now() - current_stage_record.started_at)) / 60;
  END IF;
  
  -- Mark current stage as completed
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = auth.uid(),
    actual_duration_minutes = actual_duration_minutes,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND production_stage_id = p_current_stage_id;
  
  -- Find and activate all next available stages
  -- This includes both parallel stages at the same order and sequential stages
  FOR next_stage_record IN
    SELECT jsi.id, jsi.dependency_group, jsi.stage_order
    FROM public.job_stage_instances jsi
    WHERE jsi.job_id = p_job_id 
      AND jsi.job_table_name = p_job_table_name
      AND jsi.status = 'pending'
      AND (
        -- Parallel stages at same order level (no dependency group or different group)
        (jsi.stage_order = current_stage_record.stage_order AND 
         (jsi.dependency_group IS NULL OR jsi.dependency_group != current_stage_record.dependency_group))
        OR
        -- Next sequential stage (higher order) where dependencies are satisfied
        (jsi.stage_order > current_stage_record.stage_order AND
         (jsi.dependency_group IS NULL OR 
          public.check_dependency_completion(p_job_id, p_job_table_name, jsi.dependency_group)))
      )
    ORDER BY jsi.stage_order ASC, jsi.created_at ASC
  LOOP
    -- Activate the next stage
    UPDATE public.job_stage_instances
    SET 
      status = 'active',
      started_at = now(),
      started_by = auth.uid(),
      updated_at = now()
    WHERE id = next_stage_record.id;
  END LOOP;
  
  RETURN TRUE;
END;
$function$