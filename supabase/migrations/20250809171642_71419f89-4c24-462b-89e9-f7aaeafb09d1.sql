-- Fix advance_parallel_job_stage function to properly handle independent part progression
CREATE OR REPLACE FUNCTION public.advance_parallel_job_stage(
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
  current_stage_record RECORD;
  actual_duration_minutes INTEGER;
  current_stage_order INTEGER;
  next_stage_records RECORD;
  dependency_group_id uuid;
  parallel_stages_in_group INTEGER;
  completed_stages_in_group INTEGER;
BEGIN
  -- Get the current stage instance details
  SELECT jsi.*, ps.name as stage_name, jsi.dependency_group, jsi.part_assignment
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
    actual_duration_minutes := EXTRACT(EPOCH FROM (now() - current_stage_record.started_at)) / 60;
  END IF;
  
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
  
  current_stage_order := current_stage_record.stage_order;
  dependency_group_id := current_stage_record.dependency_group;
  
  RAISE NOTICE 'Completed stage: % (%) for job %, part: %', 
    current_stage_record.stage_name, 
    p_current_stage_id, 
    p_job_id,
    current_stage_record.part_assignment;
  
  -- Find and activate next stage(s) based on part assignment and workflow logic
  FOR next_stage_records IN
    SELECT DISTINCT
      jsi.id,
      jsi.production_stage_id,
      jsi.part_assignment,
      jsi.dependency_group,
      jsi.stage_order,
      ps.name as stage_name
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
    WHERE jsi.job_id = p_job_id 
      AND jsi.job_table_name = p_job_table_name
      AND jsi.stage_order > current_stage_order
      AND jsi.status = 'pending'
      AND (
        -- FIXED: Better part assignment matching logic
        -- Case 1: Current completed stage was 'both' - activate all next stages
        (current_stage_record.part_assignment = 'both') OR
        -- Case 2: Current completed stage was specific part - activate matching part stages and 'both' stages
        (current_stage_record.part_assignment IS NOT NULL AND 
         (jsi.part_assignment = current_stage_record.part_assignment OR jsi.part_assignment = 'both')) OR
        -- Case 3: Current completed stage had no part assignment - activate all
        (current_stage_record.part_assignment IS NULL) OR
        -- Case 4: Next stage has no part assignment - activate it
        (jsi.part_assignment IS NULL)
      )
    ORDER BY jsi.stage_order ASC
    LIMIT 20 -- Reasonable limit to prevent infinite loops
  LOOP
    -- Check if this stage has dependency requirements that are met
    IF next_stage_records.dependency_group IS NOT NULL THEN
      -- For dependency groups, check if all required stages at previous orders are completed
      SELECT COUNT(*) INTO parallel_stages_in_group
      FROM public.job_stage_instances
      WHERE job_id = p_job_id 
        AND job_table_name = p_job_table_name
        AND dependency_group = next_stage_records.dependency_group
        AND stage_order < next_stage_records.stage_order;
      
      SELECT COUNT(*) INTO completed_stages_in_group
      FROM public.job_stage_instances
      WHERE job_id = p_job_id 
        AND job_table_name = p_job_table_name
        AND dependency_group = next_stage_records.dependency_group
        AND stage_order < next_stage_records.stage_order
        AND status = 'completed';
      
      -- Only activate if all dependency requirements are met
      IF completed_stages_in_group < parallel_stages_in_group THEN
        RAISE NOTICE 'Skipping stage % - dependency group % not ready (%/%)', 
          next_stage_records.stage_name,
          next_stage_records.dependency_group,
          completed_stages_in_group,
          parallel_stages_in_group;
        CONTINUE;
      END IF;
    END IF;
    
    -- Activate the next stage - but keep as pending for manual operator start
    -- We don't auto-start stages anymore, just make them available
    RAISE NOTICE 'Making available next stage: % (%) for job %, part: %', 
      next_stage_records.stage_name, 
      next_stage_records.production_stage_id,
      p_job_id,
      next_stage_records.part_assignment;
  END LOOP;
  
  RETURN TRUE;
END;
$function$;