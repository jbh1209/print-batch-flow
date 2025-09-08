-- EMERGENCY: Create missing trigger to sync proof approval timestamps
-- This trigger should have been created with the function but was missing
-- Causing all proof approvals to fail FIFO scheduling

CREATE TRIGGER trg_sync_proof_approval_timestamps
  AFTER UPDATE OF proof_approved_manually_at ON job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION sync_proof_approval_timestamps();

-- Fix D426518 timestamps immediately 
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

-- Trigger the scheduler to reschedule D426518
SELECT trigger_simple_scheduler('D426518', 'production_jobs');