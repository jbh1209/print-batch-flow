-- Update the workflow initialization functions to ensure all stages start as pending
-- This modifies the existing initialize_job_stages_auto function to NOT auto-activate the first stage

CREATE OR REPLACE FUNCTION public.initialize_job_stages_auto(p_job_id uuid, p_job_table_name text, p_category_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  stage_record RECORD;
BEGIN
  -- Create stage instances for each stage in the category (all starting as pending)
  FOR stage_record IN
    SELECT 
      cps.production_stage_id,
      cps.stage_order,
      cps.estimated_duration_hours,
      ps.running_speed_per_hour,
      ps.make_ready_time_minutes,
      ps.speed_unit
    FROM public.category_production_stages cps
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE cps.category_id = p_category_id
      AND ps.is_active = true
    ORDER BY cps.stage_order ASC
  LOOP
    INSERT INTO public.job_stage_instances (
      job_id,
      job_table_name,
      category_id,
      production_stage_id,
      stage_order,
      status,
      quantity,
      estimated_duration_minutes,
      setup_time_minutes
    ) VALUES (
      p_job_id,
      p_job_table_name,
      p_category_id,
      stage_record.production_stage_id,
      stage_record.stage_order,
      'pending', -- ALL stages start as pending - no auto-activation
      NULL, -- Will be set later when quantities are assigned
      NULL, -- Will be calculated when quantities are assigned
      COALESCE(stage_record.make_ready_time_minutes, 10) -- Default setup time
    );
  END LOOP;
  
  RETURN TRUE;
END;
$function$;