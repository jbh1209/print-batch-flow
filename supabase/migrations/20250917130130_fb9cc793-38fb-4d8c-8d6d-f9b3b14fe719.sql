-- Fix slot_end_time calculation bug and restore data integrity
-- The issue: slot_end_time was being set to slot_start_time + total_stage_minutes 
-- instead of slot_start_time + slot_duration_minutes, causing inflated end times

-- Step 1: Correct all existing stage_time_slots with wrong end times
UPDATE stage_time_slots 
SET 
  slot_end_time = slot_start_time + make_interval(mins => duration_minutes),
  updated_at = now()
WHERE slot_end_time != slot_start_time + make_interval(mins => duration_minutes);

-- Step 2: Re-sync job_stage_instances with corrected slot times
UPDATE job_stage_instances jsi
SET 
  scheduled_start_at = slot_times.actual_start,
  scheduled_end_at = slot_times.actual_end,
  scheduled_minutes = slot_times.total_minutes,
  updated_at = now()
FROM (
  SELECT 
    sts.stage_instance_id,
    MIN(sts.slot_start_time) as actual_start,
    MAX(sts.slot_end_time) as actual_end,
    SUM(sts.duration_minutes) as total_minutes
  FROM stage_time_slots sts
  WHERE sts.stage_instance_id IS NOT NULL
    AND COALESCE(sts.is_completed, false) = false
  GROUP BY sts.stage_instance_id
) slot_times
WHERE jsi.id = slot_times.stage_instance_id;

-- Step 3: Add trigger to prevent future slot_end_time calculation errors
CREATE OR REPLACE FUNCTION ensure_correct_slot_end_time()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure slot_end_time is always calculated correctly from slot_start_time + duration_minutes
  NEW.slot_end_time := NEW.slot_start_time + make_interval(mins => NEW.duration_minutes);
  
  -- Auto-set date from slot_start_time if not provided
  IF NEW.date IS NULL THEN
    NEW.date := (NEW.slot_start_time AT TIME ZONE 'UTC')::date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to stage_time_slots
DROP TRIGGER IF EXISTS trigger_ensure_correct_slot_end_time ON stage_time_slots;
CREATE TRIGGER trigger_ensure_correct_slot_end_time
  BEFORE INSERT OR UPDATE ON stage_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION ensure_correct_slot_end_time();

-- Step 4: Create function to validate and report timing consistency
CREATE OR REPLACE FUNCTION validate_slot_timing_consistency()
RETURNS TABLE(
  issue_type text,
  stage_instance_id uuid,
  job_wo_no text,
  stage_name text,
  slot_count integer,
  jsi_start timestamptz,
  jsi_end timestamptz,
  slots_start timestamptz,
  slots_end timestamptz,
  discrepancy_minutes integer
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH slot_aggregates AS (
    SELECT 
      sts.stage_instance_id,
      MIN(sts.slot_start_time) as slots_start,
      MAX(sts.slot_end_time) as slots_end,
      COUNT(*) as slot_count
    FROM stage_time_slots sts
    WHERE sts.stage_instance_id IS NOT NULL
      AND COALESCE(sts.is_completed, false) = false
    GROUP BY sts.stage_instance_id
  ),
  mismatches AS (
    SELECT 
      CASE 
        WHEN jsi.scheduled_start_at != sa.slots_start THEN 'start_time_mismatch'
        WHEN jsi.scheduled_end_at != sa.slots_end THEN 'end_time_mismatch'
        ELSE 'unknown_mismatch'
      END as issue_type,
      jsi.id as stage_instance_id,
      pj.wo_no as job_wo_no,
      ps.name as stage_name,
      sa.slot_count::integer,
      jsi.scheduled_start_at as jsi_start,
      jsi.scheduled_end_at as jsi_end,
      sa.slots_start,
      sa.slots_end,
      EXTRACT(EPOCH FROM (jsi.scheduled_end_at - sa.slots_end))/60 as discrepancy_minutes
    FROM job_stage_instances jsi
    JOIN slot_aggregates sa ON jsi.id = sa.stage_instance_id
    JOIN production_jobs pj ON jsi.job_id = pj.id
    JOIN production_stages ps ON jsi.production_stage_id = ps.id
    WHERE (
      jsi.scheduled_start_at != sa.slots_start OR
      jsi.scheduled_end_at != sa.slots_end
    )
  )
  SELECT 
    m.issue_type,
    m.stage_instance_id,
    m.job_wo_no,
    m.stage_name,
    m.slot_count,
    m.jsi_start,
    m.jsi_end,
    m.slots_start,
    m.slots_end,
    m.discrepancy_minutes::integer
  FROM mismatches m
  ORDER BY m.job_wo_no, m.stage_name;
END;
$$;