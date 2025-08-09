-- Fix the initialize_custom_job_stages_with_specs function to use supports_parts instead of hardcoded stage names
-- This aligns with the fix made to coverTextWorkflowService.ts

CREATE OR REPLACE FUNCTION public.initialize_custom_job_stages_with_specs(
  p_job_id uuid,
  p_job_table_name text,
  p_stage_mappings jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_mapping RECORD;
  stage_counter INTEGER := 1;
  has_cover_parts BOOLEAN := false;
  has_text_parts BOOLEAN := false;
  dependency_group_id UUID := NULL;
  current_part_assignment TEXT;
  stage_supports_parts BOOLEAN;
BEGIN
  -- Validate input parameters
  IF p_job_id IS NULL OR p_job_table_name IS NULL THEN
    RAISE EXCEPTION 'job_id and job_table_name must be provided';
  END IF;

  IF p_stage_mappings IS NULL OR jsonb_array_length(p_stage_mappings) = 0 THEN
    RAISE EXCEPTION 'stage_mappings must be provided and non-empty';
  END IF;

  -- First pass: detect if this is a cover/text workflow
  FOR stage_mapping IN
    SELECT 
      value->>'part_name' as part_name
    FROM jsonb_array_elements(p_stage_mappings)
  LOOP
    IF stage_mapping.part_name ILIKE '%cover%' THEN
      has_cover_parts := true;
    END IF;
    
    IF stage_mapping.part_name ILIKE '%text%' THEN
      has_text_parts := true;
    END IF;
  END LOOP;

  -- Generate dependency group if both cover and text parts are present
  IF has_cover_parts AND has_text_parts THEN
    dependency_group_id := gen_random_uuid();
    RAISE LOG 'Cover/Text workflow detected for job %, creating dependency group: %', p_job_id, dependency_group_id;
  END IF;

  -- Second pass: create stage instances with proper dependency groups based on supports_parts
  FOR stage_mapping IN
    SELECT 
      (value->>'stage_id')::uuid as stage_id,
      value->>'unique_stage_id' as unique_stage_id,
      (value->>'stage_order')::integer as stage_order,
      (value->>'stage_specification_id')::uuid as stage_specification_id,
      value->>'part_name' as part_name,
      (value->>'quantity')::integer as quantity,
      value->>'paper_specification' as paper_specification
    FROM jsonb_array_elements(p_stage_mappings)
    ORDER BY (value->>'stage_order')::integer
  LOOP
    -- Get the supports_parts flag from the production_stages table
    SELECT ps.supports_parts INTO stage_supports_parts
    FROM public.production_stages ps
    WHERE ps.id = stage_mapping.stage_id;
    
    -- Determine part assignment based on part_name
    IF stage_mapping.part_name ILIKE '%cover%' THEN
      current_part_assignment := 'cover';
    ELSIF stage_mapping.part_name ILIKE '%text%' THEN
      current_part_assignment := 'text';
    ELSE
      current_part_assignment := 'both';
    END IF;

    INSERT INTO public.job_stage_instances (
      job_id,
      job_table_name,
      category_id,
      production_stage_id,
      stage_order,
      stage_specification_id,
      part_name,
      part_assignment,
      quantity,
      status,
      dependency_group,
      notes,
      unique_stage_key
    ) VALUES (
      p_job_id,
      p_job_table_name,
      NULL, -- No category for custom workflows with specifications
      stage_mapping.stage_id,
      stage_mapping.stage_order,
      stage_mapping.stage_specification_id,
      stage_mapping.part_name,
      current_part_assignment,
      stage_mapping.quantity,
      'pending', -- All stages start as pending
      CASE 
        WHEN dependency_group_id IS NOT NULL AND NOT COALESCE(stage_supports_parts, false) THEN dependency_group_id
        ELSE NULL
      END,
      CASE 
        WHEN stage_mapping.paper_specification IS NOT NULL THEN 
          'Paper: ' || stage_mapping.paper_specification
        ELSE NULL 
      END,
      -- Generate unique key using job_id, stage counter, and unique_stage_id to prevent collisions
      COALESCE(stage_mapping.unique_stage_id, p_job_id::text || '_' || stage_counter::text || '_' || stage_mapping.stage_id::text)
    );
    
    stage_counter := stage_counter + 1;
  END LOOP;
  
  -- Mark the job as having a custom workflow
  EXECUTE format('UPDATE %I SET has_custom_workflow = TRUE, updated_at = now() WHERE id = $1', p_job_table_name)
  USING p_job_id;
  
  RETURN TRUE;
END;
$$;