-- Fix D426518 timestamps and schedule since trigger exists
UPDATE production_jobs 
SET 
  proof_approved_at = '2025-09-08 08:34:00.38+00'::timestamptz,
  updated_at = now()
WHERE wo_no = 'D426518' AND proof_approved_at IS NULL;

-- Clear D426518's existing schedule to force proper reschedule
DELETE FROM stage_time_slots 
WHERE stage_instance_id IN (
  SELECT jsi.id 
  FROM job_stage_instances jsi
  JOIN production_jobs pj ON pj.id = jsi.job_id
  WHERE pj.wo_no = 'D426518'
);

-- Update D426518's schedule status to force reschedule
UPDATE job_stage_instances
SET 
  schedule_status = 'unscheduled',
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = 0
WHERE job_id IN (
  SELECT id FROM production_jobs WHERE wo_no = 'D426518'
) AND status = 'pending';

-- Reschedule everything
SELECT simple_scheduler_wrapper('reschedule_all');