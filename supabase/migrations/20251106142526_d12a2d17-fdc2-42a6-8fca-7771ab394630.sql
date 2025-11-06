-- Create functions to unschedule stages for unapproved jobs
-- Function 1: Unschedule all unapproved jobs' incomplete stages
CREATE OR REPLACE FUNCTION public.scheduler_unschedule_unapproved()
RETURNS TABLE (unscheduled_jsi integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH affected AS (
    UPDATE public.job_stage_instances jsi
    SET 
      scheduled_start_at = NULL,
      scheduled_end_at   = NULL,
      scheduled_minutes  = NULL,
      schedule_status    = 'pending',
      updated_at         = now()
    FROM public.production_jobs pj
    WHERE pj.id = jsi.job_id
      AND pj.proof_approved_at IS NULL
      AND jsi.completed_at IS NULL
      AND (jsi.scheduled_start_at IS NOT NULL OR jsi.scheduled_end_at IS NOT NULL)
    RETURNING jsi.id
  )
  SELECT COUNT(*) INTO v_count FROM affected;

  RETURN QUERY SELECT COALESCE(v_count, 0);
END;
$$;

-- Function 2: Unschedule for specific job_ids only if they are unapproved
CREATE OR REPLACE FUNCTION public.scheduler_unschedule_jobs_if_unapproved(p_job_ids uuid[])
RETURNS TABLE (unscheduled_jsi integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_job_ids IS NULL OR array_length(p_job_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0; -- nothing to do
    RETURN;
  END IF;

  WITH affected AS (
    UPDATE public.job_stage_instances jsi
    SET 
      scheduled_start_at = NULL,
      scheduled_end_at   = NULL,
      scheduled_minutes  = NULL,
      schedule_status    = 'pending',
      updated_at         = now()
    FROM public.production_jobs pj
    WHERE pj.id = jsi.job_id
      AND pj.id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NULL
      AND jsi.completed_at IS NULL
      AND (jsi.scheduled_start_at IS NOT NULL OR jsi.scheduled_end_at IS NOT NULL)
    RETURNING jsi.id
  )
  SELECT COUNT(*) INTO v_count FROM affected;

  RETURN QUERY SELECT COALESCE(v_count, 0);
END;
$$;