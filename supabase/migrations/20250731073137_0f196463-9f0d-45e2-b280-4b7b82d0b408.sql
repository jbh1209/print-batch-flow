-- Update initialize_custom_job_stages_with_specs to support parallel processing for cover/text workflows
CREATE OR REPLACE FUNCTION public.initialize_custom_job_stages_with_specs(p_job_id uuid, p_job_table_name text, p_stage_mappings jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  stage_mapping RECORD;
  stage_counter INTEGER := 1;
  has_cover_parts BOOLEAN := false;
  has_text_parts BOOLEAN := false;
  dependency_group_id UUID := NULL;
  current_part_assignment TEXT;
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

  -- Second pass: create stage instances with proper dependency groups
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
        WHEN dependency_group_id IS NOT NULL AND current_part_assignment = 'both' THEN dependency_group_id
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
$function$;

-- Fix existing jobs that should have dependency groups but don't
CREATE OR REPLACE FUNCTION public.fix_existing_cover_text_workflows()
 RETURNS TABLE(fixed_job_id uuid, wo_no text, dependency_group_assigned uuid, stages_updated integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  job_record RECORD;
  new_dependency_group UUID;
  updated_stages INTEGER;
  has_cover BOOLEAN;
  has_text BOOLEAN;
BEGIN
  -- Find jobs with custom workflows that have both cover and text parts but no dependency groups
  FOR job_record IN
    SELECT DISTINCT 
      pj.id,
      pj.wo_no
    FROM public.production_jobs pj
    INNER JOIN public.job_stage_instances jsi ON pj.id = jsi.job_id
    WHERE pj.has_custom_workflow = true
      AND jsi.job_table_name = 'production_jobs'
      AND jsi.dependency_group IS NULL
    GROUP BY pj.id, pj.wo_no
    HAVING 
      COUNT(CASE WHEN jsi.part_assignment = 'cover' THEN 1 END) > 0 AND
      COUNT(CASE WHEN jsi.part_assignment = 'text' THEN 1 END) > 0
  LOOP
    -- Generate new dependency group for this job
    new_dependency_group := gen_random_uuid();
    
    -- Update stages that should have dependency groups (part_assignment = 'both')
    UPDATE public.job_stage_instances
    SET 
      dependency_group = new_dependency_group,
      updated_at = now()
    WHERE job_id = job_record.id
      AND job_table_name = 'production_jobs'
      AND part_assignment = 'both'
      AND dependency_group IS NULL;
    
    GET DIAGNOSTICS updated_stages = ROW_COUNT;
    
    -- Only return if we actually updated stages
    IF updated_stages > 0 THEN
      RETURN QUERY SELECT 
        job_record.id,
        job_record.wo_no,
        new_dependency_group,
        updated_stages;
    END IF;
  END LOOP;
END;
$function$;

-- Run the fix for existing jobs
SELECT * FROM public.fix_existing_cover_text_workflows();