-- Fix the ambiguous column reference in advance_job_stage function
-- This is causing the DTP modal to fail with "column reference 'actual_duration_minutes' is ambiguous"

CREATE OR REPLACE FUNCTION public.advance_job_stage(
  p_job_id uuid,
  p_job_table_name text,
  p_current_stage_id uuid,
  p_completed_by uuid DEFAULT auth.uid(),
  p_notes text DEFAULT NULL,
  p_actual_duration_minutes integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stage RECORD;
  next_stage_id UUID;
  stage_completed BOOLEAN := false;
  p_actual_duration integer := p_actual_duration_minutes; -- Rename to avoid ambiguity
BEGIN
  -- Get current stage info with explicit column qualification
  SELECT 
    jsi.id,
    jsi.job_id,
    jsi.production_stage_id,
    jsi.status,
    jsi.stage_order,
    jsi.started_at,
    jsi.actual_duration_minutes as jsi_actual_duration,
    ps.name as stage_name
  INTO current_stage
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.id = p_current_stage_id
    AND jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name;

  -- Validate current stage exists and is active
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current stage not found or not active for job %', p_job_id;
  END IF;

  IF current_stage.status != 'active' THEN
    RAISE EXCEPTION 'Stage % is not active (current status: %)', current_stage.stage_name, current_stage.status;
  END IF;

  -- Complete the current stage with explicit column names
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = p_completed_by,
    notes = COALESCE(p_notes, job_stage_instances.notes),
    actual_duration_minutes = COALESCE(p_actual_duration, job_stage_instances.actual_duration_minutes),
    updated_at = now()
  WHERE id = p_current_stage_id;

  stage_completed := true;

  -- Find next stage in sequence
  SELECT jsi.id INTO next_stage_id
  FROM public.job_stage_instances jsi
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.stage_order = current_stage.stage_order + 1
    AND jsi.status = 'pending'
  ORDER BY jsi.stage_order ASC
  LIMIT 1;

  -- Activate next stage if found
  IF next_stage_id IS NOT NULL THEN
    UPDATE public.job_stage_instances
    SET 
      status = 'active',
      started_at = now(),
      started_by = p_completed_by,
      updated_at = now()
    WHERE id = next_stage_id;
  ELSE
    -- No more stages, mark job as completed
    CASE p_job_table_name
      WHEN 'production_jobs' THEN
        UPDATE public.production_jobs
        SET 
          status = 'Completed',
          updated_at = now()
        WHERE id = p_job_id;
      WHEN 'business_card_jobs' THEN
        UPDATE public.business_card_jobs
        SET 
          status = 'completed',
          updated_at = now()
        WHERE id = p_job_id;
      WHEN 'poster_jobs' THEN
        UPDATE public.poster_jobs
        SET 
          status = 'completed',
          updated_at = now()
        WHERE id = p_job_id;
      WHEN 'sleeve_jobs' THEN
        UPDATE public.sleeve_jobs
        SET 
          status = 'completed',
          updated_at = now()
        WHERE id = p_job_id;
      WHEN 'cover_jobs' THEN
        UPDATE public.cover_jobs
        SET 
          status = 'completed',
          updated_at = now()
        WHERE id = p_job_id;
      WHEN 'box_jobs' THEN
        UPDATE public.box_jobs
        SET 
          status = 'completed',
          updated_at = now()
        WHERE id = p_job_id;
    END CASE;
  END IF;

  RETURN stage_completed;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to advance job stage: %', SQLERRM;
END;
$$;