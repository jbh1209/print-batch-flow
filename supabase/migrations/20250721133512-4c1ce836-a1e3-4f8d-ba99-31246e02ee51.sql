-- Add a column to store the unique stage ID for quantity mapping
ALTER TABLE job_stage_instances 
ADD COLUMN unique_stage_key text;

-- Update the function to store the unique stage ID
CREATE OR REPLACE FUNCTION public.initialize_custom_job_stages_with_specs(
  p_job_id uuid,
  p_job_table_name text,
  p_stage_mappings jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  stage_mapping RECORD;
  first_stage BOOLEAN := TRUE;
BEGIN
  -- Validate input parameters
  IF p_job_id IS NULL OR p_job_table_name IS NULL THEN
    RAISE EXCEPTION 'job_id and job_table_name must be provided';
  END IF;

  IF p_stage_mappings IS NULL OR jsonb_array_length(p_stage_mappings) = 0 THEN
    RAISE EXCEPTION 'stage_mappings must be provided and non-empty';
  END IF;

  -- Create stage instances for each mapping in the provided order
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
  LOOP
    INSERT INTO public.job_stage_instances (
      job_id,
      job_table_name,
      category_id,
      production_stage_id,
      stage_order,
      stage_specification_id,
      part_name,
      quantity,
      status,
      started_at,
      started_by,
      notes,
      unique_stage_key
    ) VALUES (
      p_job_id,
      p_job_table_name,
      NULL, -- No category for custom workflows with specifications
      stage_mapping.stage_id, -- Use original stage_id for production_stage_id reference
      stage_mapping.stage_order,
      stage_mapping.stage_specification_id,
      stage_mapping.part_name,
      stage_mapping.quantity,
      CASE WHEN first_stage THEN 'active' ELSE 'pending' END,
      CASE WHEN first_stage THEN now() ELSE NULL END,
      CASE WHEN first_stage THEN auth.uid() ELSE NULL END,
      CASE 
        WHEN stage_mapping.paper_specification IS NOT NULL THEN 
          'Paper: ' || stage_mapping.paper_specification
        ELSE NULL 
      END,
      stage_mapping.unique_stage_id -- Store the unique stage key for quantity mapping
    );
    
    first_stage := FALSE;
  END LOOP;
  
  -- Mark the job as having a custom workflow
  EXECUTE format('UPDATE %I SET has_custom_workflow = TRUE, updated_at = now() WHERE id = $1', p_job_table_name)
  USING p_job_id;
  
  RETURN TRUE;
END;
$function$;