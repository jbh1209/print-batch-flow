-- Fix initialize_custom_job_stages_with_specs to respect part_assignment for dependency groups
CREATE OR REPLACE FUNCTION public.initialize_custom_job_stages_with_specs(
  p_job_id uuid,
  p_job_table_name text,
  p_custom_workflow jsonb,
  p_dependency_group_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  stage_record RECORD;
  workflow_stage JSONB;
  stage_instance_id uuid;
  current_dependency_group uuid;
BEGIN
  -- If no custom workflow provided, return success
  IF p_custom_workflow IS NULL OR jsonb_array_length(p_custom_workflow) = 0 THEN
    RETURN true;
  END IF;

  -- Use provided dependency group or generate new one
  current_dependency_group := COALESCE(p_dependency_group_id, gen_random_uuid());

  -- Process each stage in the custom workflow
  FOR i IN 0..jsonb_array_length(p_custom_workflow) - 1 LOOP
    workflow_stage := p_custom_workflow->i;
    
    -- Get stage details
    SELECT ps.* INTO stage_record
    FROM public.production_stages ps
    WHERE ps.id = (workflow_stage->>'production_stage_id')::uuid;
    
    IF NOT FOUND THEN
      CONTINUE; -- Skip if stage not found
    END IF;

    -- Determine dependency group assignment based on part_assignment
    -- Independent finishing stages (cover/text specific) get NULL dependency_group
    -- Synchronization stages (both) get the dependency_group_id
    INSERT INTO public.job_stage_instances (
      job_id,
      job_table_name,
      category_id,
      production_stage_id,
      stage_order,
      part_name,
      part_type,
      part_assignment,
      -- CRITICAL FIX: Only assign dependency_group for synchronization stages (part_assignment = 'both')
      dependency_group = CASE 
        WHEN (workflow_stage->>'part_assignment')::text = 'both' THEN current_dependency_group
        ELSE NULL -- Independent stages (cover/text) get NULL for parallel processing
      END,
      quantity,
      estimated_duration_minutes,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_job_id,
      p_job_table_name,
      (workflow_stage->>'category_id')::uuid,
      stage_record.id,
      (workflow_stage->>'stage_order')::integer,
      workflow_stage->>'part_name',
      workflow_stage->>'part_type',
      workflow_stage->>'part_assignment',
      CASE 
        WHEN (workflow_stage->>'part_assignment')::text = 'both' THEN current_dependency_group
        ELSE NULL
      END,
      (workflow_stage->>'quantity')::integer,
      (workflow_stage->>'estimated_duration_minutes')::integer,
      COALESCE(workflow_stage->>'status', 'pending'),
      now(),
      now()
    ) RETURNING id INTO stage_instance_id;

    -- Add job print specifications if provided
    IF workflow_stage ? 'specifications' AND jsonb_typeof(workflow_stage->'specifications') = 'array' THEN
      INSERT INTO public.job_print_specifications (
        job_id,
        job_table_name,
        specification_category,
        specification_id,
        printer_id
      )
      SELECT 
        p_job_id,
        p_job_table_name,
        spec->>'category',
        (spec->>'specification_id')::uuid,
        (spec->>'printer_id')::uuid
      FROM jsonb_array_elements(workflow_stage->'specifications') AS spec
      WHERE spec->>'specification_id' IS NOT NULL;
    END IF;

  END LOOP;

  RETURN true;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in initialize_custom_job_stages_with_specs: %', SQLERRM;
    RETURN false;
END;
$function$;