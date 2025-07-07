-- Fix the initialize_job_stages_auto function to use correct column names
-- The function was referencing non-existent 'allows_concurrent_start' column

DROP FUNCTION IF EXISTS public.initialize_job_stages_auto(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.initialize_job_stages_auto(
  p_job_id uuid,
  p_job_table_name text,
  p_category_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  stage_record RECORD;
BEGIN
  -- Validate inputs
  IF p_job_id IS NULL OR p_job_table_name IS NULL OR p_category_id IS NULL THEN
    RAISE EXCEPTION 'job_id, job_table_name, and category_id must be provided.';
  END IF;

  -- Clear any existing stages for this job first
  DELETE FROM public.job_stage_instances
  WHERE job_id = p_job_id AND job_table_name = p_job_table_name;

  -- Create stage instances for each stage in the category workflow
  FOR stage_record IN
    SELECT 
      cps.production_stage_id,
      cps.stage_order,
      ps.supports_parts
    FROM public.category_production_stages cps
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE cps.category_id = p_category_id
    ORDER BY cps.stage_order ASC
  LOOP
    -- Create normal stage instances (parts will be handled later if needed)
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
      'pending'  -- All stages start as pending
    );
  END LOOP;

  -- Verify that stages were created
  IF NOT EXISTS (
    SELECT 1 FROM public.job_stage_instances 
    WHERE job_id = p_job_id AND job_table_name = p_job_table_name
  ) THEN
    RAISE EXCEPTION 'No workflow stages were created for category %', p_category_id;
  END IF;

  RETURN TRUE;
END;
$function$;