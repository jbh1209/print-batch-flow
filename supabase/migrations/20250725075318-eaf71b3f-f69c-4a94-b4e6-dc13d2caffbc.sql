-- Phase 1: Fix the problematic database constraint

-- First, drop the existing constraint that's causing issues
DROP INDEX IF EXISTS idx_job_stage_instances_unique_detailed;

-- Create a new job-scoped constraint that allows multiple jobs to have similar stages
-- but prevents true duplicates within the same job
CREATE UNIQUE INDEX idx_job_stage_instances_job_scoped_unique 
ON public.job_stage_instances 
USING btree (
  job_id, 
  job_table_name, 
  production_stage_id, 
  COALESCE((stage_specification_id)::text, ''::text), 
  COALESCE(part_name, ''::text), 
  COALESCE(unique_stage_key, production_stage_id::text)
);

-- Update the initialize_custom_job_stages_with_specs function to handle unique_stage_key properly
CREATE OR REPLACE FUNCTION public.initialize_custom_job_stages_with_specs(p_job_id uuid, p_job_table_name text, p_stage_mappings jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  stage_mapping RECORD;
  stage_counter INTEGER := 1;
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
      stage_mapping.quantity,
      'pending', -- All stages start as pending
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