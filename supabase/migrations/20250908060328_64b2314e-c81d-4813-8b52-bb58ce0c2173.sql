-- Emergency fix: Set missing proof_approved_at timestamps for D426517 and D426515
-- These jobs completed their proof stages but timestamps weren't synced, breaking FIFO scheduling

UPDATE production_jobs 
SET 
  proof_approved_at = '2025-09-08 05:45:26.408+00'::timestamptz,
  updated_at = now()
WHERE wo_no = 'D426517' AND proof_approved_at IS NULL;

UPDATE production_jobs 
SET 
  proof_approved_at = '2025-09-08 05:41:02.546+00'::timestamptz,
  updated_at = now()
WHERE wo_no = 'D426515' AND proof_approved_at IS NULL;

-- Clear existing schedules for these jobs to force proper reschedule
DELETE FROM stage_time_slots 
WHERE stage_instance_id IN (
  SELECT jsi.id 
  FROM job_stage_instances jsi
  JOIN production_jobs pj ON pj.id = jsi.job_id
  WHERE pj.wo_no IN ('D426517', 'D426515')
);

-- Update schedule status to force reschedule
UPDATE job_stage_instances
SET 
  schedule_status = 'unscheduled',
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = 0
WHERE job_id IN (
  SELECT id FROM production_jobs WHERE wo_no IN ('D426517', 'D426515')
) AND status = 'pending';