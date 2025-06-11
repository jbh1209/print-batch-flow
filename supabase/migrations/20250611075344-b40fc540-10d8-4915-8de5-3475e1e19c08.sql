
-- Fix the initialize_job_stages_with_part_assignments function to properly handle JSONB part assignments
CREATE OR REPLACE FUNCTION public.initialize_job_stages_with_part_assignments(
  p_job_id uuid, 
  p_job_table_name text, 
  p_category_id uuid, 
  p_part_assignments jsonb DEFAULT NULL::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  stage_record RECORD;
  part_name TEXT;
  part_definitions_array JSONB;
  assigned_stage_id UUID;
  part_assignment_value TEXT;
BEGIN
  -- Validate input parameters
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'Job ID cannot be null';
  END IF;
  
  IF p_job_table_name IS NULL OR p_job_table_name = '' THEN
    RAISE EXCEPTION 'Job table name cannot be null or empty';
  END IF;
  
  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'Category ID cannot be null';
  END IF;
  
  -- Check if category exists
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id) THEN
    RAISE EXCEPTION 'Category with ID % does not exist', p_category_id;
  END IF;
  
  -- Delete any existing stage instances for this job to avoid duplicates
  DELETE FROM public.job_stage_instances 
  WHERE job_id = p_job_id AND job_table_name = p_job_table_name;
  
  -- Create stage instances for each stage in the category - ALL START AS PENDING
  FOR stage_record IN
    SELECT 
      cps.production_stage_id,
      cps.stage_order,
      cps.estimated_duration_hours,
      ps.is_multi_part,
      ps.part_definitions,
      ps.name as stage_name
    FROM public.category_production_stages cps
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE cps.category_id = p_category_id
    ORDER BY cps.stage_order ASC
  LOOP
    -- Safely handle part_definitions - ensure it's always treated as an array
    part_definitions_array := COALESCE(stage_record.part_definitions, '[]'::jsonb);
    
    -- If part_definitions is not an array (scalar value), convert to empty array
    IF jsonb_typeof(part_definitions_array) != 'array' THEN
      part_definitions_array := '[]'::jsonb;
    END IF;
    
    -- Check if this is a multi-part stage with valid part definitions
    IF stage_record.is_multi_part AND jsonb_array_length(part_definitions_array) > 0 THEN
      -- Create an instance for each part - check for part assignments
      FOR part_name IN 
        SELECT jsonb_array_elements_text(part_definitions_array)
      LOOP
        -- Check if this part has a specific stage assignment
        IF p_part_assignments IS NOT NULL AND (p_part_assignments ? part_name) THEN
          -- Get the value and safely convert to UUID
          part_assignment_value := p_part_assignments->>part_name;
          
          -- Validate that the assignment value is a valid UUID
          BEGIN
            assigned_stage_id := part_assignment_value::uuid;
          EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'Invalid UUID format for part assignment: % -> %', part_name, part_assignment_value;
          END;
          
          -- Verify the assigned stage exists
          IF NOT EXISTS (SELECT 1 FROM public.production_stages WHERE id = assigned_stage_id) THEN
            RAISE EXCEPTION 'Assigned stage ID % does not exist for part %', assigned_stage_id, part_name;
          END IF;
          
          -- Create instance with the assigned stage
          INSERT INTO public.job_stage_instances (
            job_id,
            job_table_name,
            category_id,
            production_stage_id,
            stage_order,
            part_name,
            status
          ) VALUES (
            p_job_id,
            p_job_table_name,
            p_category_id,
            assigned_stage_id,
            stage_record.stage_order,
            part_name,
            'pending'
          );
        ELSE
          -- No specific assignment, use the original stage
          INSERT INTO public.job_stage_instances (
            job_id,
            job_table_name,
            category_id,
            production_stage_id,
            stage_order,
            part_name,
            status
          ) VALUES (
            p_job_id,
            p_job_table_name,
            p_category_id,
            stage_record.production_stage_id,
            stage_record.stage_order,
            part_name,
            'pending'
          );
        END IF;
      END LOOP;
    ELSE
      -- Create single instance for non-multi-part stages - ALL PENDING
      INSERT INTO public.job_stage_instances (
        job_id,
        job_table_name,
        category_id,
        production_stage_id,
        stage_order,
        status
      ) VALUES (
        p_job_id,
        p_job_table_name,
        p_category_id,
        stage_record.production_stage_id,
        stage_record.stage_order,
        'pending'
      );
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$function$;

-- Create a function to repair jobs that have categories but no stage instances
CREATE OR REPLACE FUNCTION public.repair_jobs_missing_stages()
RETURNS TABLE(repaired_job_id uuid, job_wo_no text, category_name text, stages_created integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  job_record RECORD;
  stages_count INTEGER;
BEGIN
  -- Find jobs that have categories but no stage instances
  FOR job_record IN
    SELECT 
      pj.id,
      pj.wo_no,
      pj.category_id,
      c.name as category_name
    FROM public.production_jobs pj
    JOIN public.categories c ON pj.category_id = c.id
    LEFT JOIN public.job_stage_instances jsi ON (
      jsi.job_id = pj.id 
      AND jsi.job_table_name = 'production_jobs'
    )
    WHERE pj.category_id IS NOT NULL
      AND jsi.id IS NULL
  LOOP
    -- Initialize stages for this job using the standard function
    PERFORM public.initialize_job_stages_auto(
      job_record.id,
      'production_jobs',
      job_record.category_id
    );
    
    -- Count how many stages were created
    SELECT COUNT(*) INTO stages_count
    FROM public.job_stage_instances
    WHERE job_id = job_record.id AND job_table_name = 'production_jobs';
    
    -- Return the repair result
    RETURN QUERY SELECT 
      job_record.id,
      job_record.wo_no,
      job_record.category_name,
      stages_count;
  END LOOP;
END;
$function$;

-- Run the repair function to fix existing broken jobs
SELECT * FROM public.repair_jobs_missing_stages();
