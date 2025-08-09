-- Fix parallel finishing for cover/text workflows
-- Phase 1: Update initialize_custom_job_stages_with_specs to use correct dependency logic

CREATE OR REPLACE FUNCTION public.initialize_custom_job_stages_with_specs(
  p_job_id uuid,
  p_job_table_name text,
  p_category_id uuid,
  p_part_assignments jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  stage_record RECORD;
  part_assignment_value text;
  dependency_group_id uuid;
  stage_name text;
  should_have_dependency boolean;
BEGIN
  -- Generate a dependency group ID for this job's synchronization stages
  dependency_group_id := gen_random_uuid();
  
  -- Create stage instances for each stage in the category
  FOR stage_record IN
    SELECT 
      cps.production_stage_id,
      cps.stage_order,
      cps.estimated_duration_hours,
      ps.name as stage_name,
      ps.running_speed_per_hour,
      ps.make_ready_time_minutes,
      ps.speed_unit
    FROM public.category_production_stages cps
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE cps.category_id = p_category_id
      AND ps.is_active = true
    ORDER BY cps.stage_order ASC
  LOOP
    stage_name := stage_record.stage_name;
    
    -- Get part assignment from the provided assignments
    part_assignment_value := COALESCE(
      p_part_assignments->>stage_record.production_stage_id::text, 
      'both'
    );
    
    -- Determine if this stage should wait for dependencies (TRUE synchronization stages only)
    -- These are stages where cover and text parts come together
    should_have_dependency := (
      stage_name ILIKE '%Perfect Binding%' OR
      stage_name ILIKE '%Saddle Stitching%' OR
      stage_name ILIKE '%Collating%' OR
      stage_name ILIKE '%Assembly%' OR
      stage_name ILIKE '%Binding%' OR
      stage_name ILIKE '%Final Assembly%' OR
      stage_name ILIKE '%Quality Check%' OR
      stage_name ILIKE '%Packing%' OR
      stage_name ILIKE '%Dispatch%' OR
      stage_name ILIKE '%Gathering%' OR
      stage_name ILIKE '%Collection%' OR
      stage_name ILIKE '%Delivery%' OR
      stage_name ILIKE '%Final Trimming%' OR
      stage_name ILIKE '%Inspection%' OR
      stage_name ILIKE '%Packaging%'
    );
    
    -- Part-specific finishing stages should NOT have dependency groups:
    -- Hunkeler (text-specific), UV Varnishing (cover-specific), etc.
    
    INSERT INTO public.job_stage_instances (
      job_id,
      job_table_name,
      category_id,
      production_stage_id,
      stage_order,
      status,
      part_assignment,
      quantity,
      estimated_duration_minutes,
      setup_time_minutes,
      dependency_group
    ) VALUES (
      p_job_id,
      p_job_table_name,
      p_category_id,
      stage_record.production_stage_id,
      stage_record.stage_order,
      'pending',
      part_assignment_value,
      NULL, -- Will be set later when quantities are assigned
      NULL, -- Will be calculated when quantities are assigned
      COALESCE(stage_record.make_ready_time_minutes, 10),
      CASE WHEN should_have_dependency THEN dependency_group_id ELSE NULL END
    );
  END LOOP;
  
  RETURN TRUE;
END;
$function$;

-- Phase 2: Fix existing jobs with incorrect dependency groups on part-specific finishing stages
-- Remove dependency groups from Hunkeler and other part-specific finishing stages

UPDATE public.job_stage_instances 
SET dependency_group = NULL, updated_at = now()
WHERE dependency_group IS NOT NULL
  AND production_stage_id IN (
    SELECT ps.id 
    FROM public.production_stages ps 
    WHERE ps.name ILIKE '%Hunkeler%'
       OR ps.name ILIKE '%UV Varnish%'
       OR ps.name ILIKE '%Laminating%'
       OR ps.name ILIKE '%Die Cutting%'
  );