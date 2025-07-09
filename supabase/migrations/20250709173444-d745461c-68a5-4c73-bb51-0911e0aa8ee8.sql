-- Create enhanced job stage initialization function
CREATE OR REPLACE FUNCTION public.initialize_job_stages_auto(
  p_job_id uuid,
  p_job_table_name text,
  p_category_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
      'pending', -- All stages start as pending
      NULL, -- Will be set later when quantities are assigned
      NULL, -- Will be calculated when quantities are assigned
      COALESCE(stage_record.make_ready_time_minutes, 10) -- Default setup time
    );
  END LOOP;
  
  RETURN TRUE;
END;
$$;

-- Create function to advance job stage with timing updates
CREATE OR REPLACE FUNCTION public.advance_job_stage(
  p_job_id uuid,
  p_job_table_name text,
  p_current_stage_id uuid,
  p_notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stage_record RECORD;
  next_stage_record RECORD;
  actual_duration_minutes INTEGER;
BEGIN
  -- Get the current stage instance
  SELECT * INTO current_stage_record
  FROM public.job_stage_instances
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND production_stage_id = p_current_stage_id
    AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current stage not found or not active';
  END IF;
  
  -- Calculate actual duration if stage was started
  IF current_stage_record.started_at IS NOT NULL THEN
    actual_duration_minutes := EXTRACT(EPOCH FROM (now() - current_stage_record.started_at)) / 60;
  END IF;
  
  -- Mark current stage as completed
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = auth.uid(),
    actual_duration_minutes = actual_duration_minutes,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND production_stage_id = p_current_stage_id;
  
  -- Find and activate the next stage
  SELECT * INTO next_stage_record
  FROM public.job_stage_instances
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND stage_order > current_stage_record.stage_order
    AND status = 'pending'
  ORDER BY stage_order ASC
  LIMIT 1;
  
  -- If there's a next stage, activate it
  IF FOUND THEN
    UPDATE public.job_stage_instances
    SET 
      status = 'active',
      started_at = now(),
      started_by = auth.uid(),
      updated_at = now()
    WHERE id = next_stage_record.id;
  END IF;
  
  RETURN TRUE;
END;
$$;