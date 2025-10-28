-- Enhanced nuclear cleanup for scheduler_reschedule_all_by_division
-- This ensures a truly clean slate before scheduling

CREATE OR REPLACE FUNCTION scheduler_reschedule_all_by_division(
  p_division TEXT DEFAULT NULL,
  p_commit BOOLEAN DEFAULT TRUE,
  p_proposed BOOLEAN DEFAULT TRUE,
  p_only_if_unset BOOLEAN DEFAULT TRUE,
  p_nuclear BOOLEAN DEFAULT FALSE,
  p_start_from TIMESTAMPTZ DEFAULT NULL,
  p_only_job_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
  v_jobs_considered INTEGER := 0;
  v_scheduled INTEGER := 0;
  v_updated INTEGER := 0;
BEGIN
  -- COMPREHENSIVE NUCLEAR CLEANUP
  -- Clear scheduled times from completed JSIs (they're done, no future slots needed)
  UPDATE job_stage_instances 
  SET scheduled_start_at = NULL, 
      scheduled_end_at = NULL, 
      scheduled_minutes = NULL, 
      schedule_status = NULL, 
      updated_at = now()
  WHERE status = 'completed'
  AND (p_division IS NULL OR production_stage_id IN (
    SELECT id FROM production_stages WHERE division = p_division
  ));

  -- Mark orphan slots as completed (JSI is done but slot isn't marked)
  UPDATE stage_time_slots sts
  SET is_completed = true
  FROM job_stage_instances jsi
  WHERE sts.stage_instance_id = jsi.id
  AND jsi.status = 'completed'
  AND COALESCE(sts.is_completed, false) = false
  AND (p_division IS NULL OR sts.production_stage_id IN (
    SELECT id FROM production_stages WHERE division = p_division
  ));

  -- Delete any remaining non-completed slots (this now catches everything)
  IF p_nuclear THEN
    DELETE FROM stage_time_slots 
    WHERE COALESCE(is_completed, false) = false 
    AND (p_division IS NULL OR production_stage_id IN (
      SELECT id FROM production_stages WHERE division = p_division
    ));
  END IF;

  -- Call the main scheduler logic
  SELECT simple_scheduler_wrapper(
    p_commit := p_commit,
    p_proposed := p_proposed,
    p_only_if_unset := p_only_if_unset,
    p_nuclear := p_nuclear,
    p_start_from := COALESCE(p_start_from, now()),
    p_only_job_ids := p_only_job_ids,
    p_division := p_division
  ) INTO v_result;

  RETURN v_result;
END;
$$;