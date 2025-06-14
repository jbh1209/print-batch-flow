
-- Overwrite the broken logic for multi-part assignment with a clean and direct approach

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
  assigned_stage_id UUID;
  std_stage_ids UUID[];
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
  
  -- Delete any existing stage instances for this job to avoid duplicates/conflicts
  DELETE FROM public.job_stage_instances 
  WHERE job_id = p_job_id AND job_table_name = p_job_table_name;
  
  -- STEP 1: Handle explicit part assignments first
  IF p_part_assignments IS NOT NULL AND jsonb_object_keys(p_part_assignments) IS NOT NULL THEN
    FOR part_name, assigned_stage_id IN
      SELECT key, value::uuid FROM jsonb_each_text(p_part_assignments)
    LOOP
      -- Validate that stage exists for this assignment
      IF NOT EXISTS (SELECT 1 FROM public.production_stages WHERE id = assigned_stage_id) THEN
        RAISE EXCEPTION 'Assigned stage ID % does not exist for part %', assigned_stage_id, part_name;
      END IF;
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
        1000, -- ensure part-assigned stages are after main stages, or adapt if you need order handling
        part_name,
        'pending'
      );
    END LOOP;
  END IF;
  
  -- STEP 2: Create standard workflow stages for this category (excluding stages that were explicitly part-assigned above if desired)
  FOR stage_record IN
    SELECT 
      cps.production_stage_id,
      cps.stage_order,
      cps.estimated_duration_hours,
      ps.is_multi_part
    FROM public.category_production_stages cps
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE cps.category_id = p_category_id
    ORDER BY cps.stage_order ASC
  LOOP
    -- Skip if already assigned in step 1 (for multi-parts)
    IF p_part_assignments IS NOT NULL AND stage_record.is_multi_part THEN
      CONTINUE; -- Already handled above
    END IF;
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
  END LOOP;
  
  RETURN TRUE;
END;
$function$;
