-- Phase 2: Fix Database Function Logic - Enhanced advance_parallel_job_stage
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
  
  -- If this stage has a dependency group (parallel workflow), check synchronization
  IF dependency_group_id IS NOT NULL THEN
    -- Count total stages in this dependency group at this order level
    SELECT COUNT(*) INTO parallel_stages_in_group
    FROM public.job_stage_instances
    WHERE job_id = p_job_id 
      AND job_table_name = p_job_table_name
      AND dependency_group = dependency_group_id
      AND stage_order = current_stage_order;
    
    -- Count completed stages in this dependency group at this order level
    SELECT COUNT(*) INTO completed_stages_in_group
    FROM public.job_stage_instances
    WHERE job_id = p_job_id 
      AND job_table_name = p_job_table_name
      AND dependency_group = dependency_group_id
      AND stage_order = current_stage_order
      AND status = 'completed';
    
    -- Only proceed to dependency-requiring stages if ALL stages in the dependency group are completed
    IF completed_stages_in_group < parallel_stages_in_group THEN
      -- Log that we're waiting for other parallel stages to complete
      RAISE NOTICE 'Parallel workflow: Waiting for % more stages in group % to complete', 
        (parallel_stages_in_group - completed_stages_in_group), dependency_group_id;
      
      -- Still activate independent next stages for this part
      FOR next_stage_records IN
        SELECT DISTINCT
          jsi.id,
          jsi.production_stage_id,
          jsi.part_assignment,
          ps.name as stage_name
        FROM public.job_stage_instances jsi
        JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
        WHERE jsi.job_id = p_job_id 
          AND jsi.job_table_name = p_job_table_name
          AND jsi.stage_order > current_stage_order
          AND jsi.status = 'pending'
          AND jsi.dependency_group IS NULL  -- Only activate independent stages
          AND (
            current_stage_record.part_assignment = 'both' OR 
            jsi.part_assignment = 'both' OR 
            current_stage_record.part_assignment = jsi.part_assignment
          )
        ORDER BY jsi.stage_order ASC
        LIMIT 10
      LOOP
        -- Activate independent finishing stages immediately
        UPDATE public.job_stage_instances
        SET 
          status = 'pending', -- Keep as pending - operator must manually start
          updated_at = now()
        WHERE id = next_stage_records.id;
        
        RAISE NOTICE 'Activated independent stage: % (%) for part: %', 
          next_stage_records.stage_name, 
          next_stage_records.production_stage_id,
          next_stage_records.part_assignment;
      END LOOP;
      
      RETURN TRUE; -- Success, but don't activate synchronized stages yet
    END IF;
  END IF;
  
  -- Find and activate next stage(s) based on part assignment and workflow logic
  FOR next_stage_records IN
    SELECT DISTINCT
      jsi.id,
      jsi.production_stage_id,
      jsi.part_assignment,
      jsi.dependency_group,
      ps.name as stage_name
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
    WHERE jsi.job_id = p_job_id 
      AND jsi.job_table_name = p_job_table_name
      AND jsi.stage_order > current_stage_order
      AND jsi.status = 'pending'
      AND (
        -- For parallel workflows: activate next stages that match part assignment
        (current_stage_record.part_assignment = 'both' OR jsi.part_assignment = 'both' OR 
         current_stage_record.part_assignment = jsi.part_assignment) OR
        -- For synchronization stages: activate when all dependencies are met
        (jsi.dependency_group IS NOT NULL AND 
         (SELECT COUNT(*) FROM public.job_stage_instances sync_check
          WHERE sync_check.job_id = p_job_id 
            AND sync_check.job_table_name = p_job_table_name
            AND sync_check.dependency_group = jsi.dependency_group
            AND sync_check.stage_order < jsi.stage_order
            AND sync_check.status != 'completed') = 0)
      )
    ORDER BY jsi.stage_order ASC
    LIMIT 10 -- Reasonable limit to prevent infinite loops
  LOOP
    -- Activate the next stage
    UPDATE public.job_stage_instances
    SET 
      status = 'pending', -- Keep as pending - operator must manually start
      updated_at = now()
    WHERE id = next_stage_records.id;
    
    RAISE NOTICE 'Activated next stage: % (%) for part: %', 
      next_stage_records.stage_name, 
      next_stage_records.production_stage_id,
      next_stage_records.part_assignment;
  END LOOP;
  
  RETURN TRUE;
END;
$function$;