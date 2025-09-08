-- Emergency fix for D426514 missing proof timestamps
-- Fix the production job proof_approved_at timestamp
UPDATE production_jobs 
SET proof_approved_at = '2025-09-08 04:59:31.415+00'
WHERE wo_no = 'D426514';

-- Set proof_approved_manually_at on the proof stage instance  
UPDATE job_stage_instances 
SET proof_approved_manually_at = '2025-09-08 04:59:31.415+00'
WHERE id = '2c126e14-aa56-4564-b5bf-89d39201d1b5';

-- Clear D426514's scheduled times to force reschedule in correct FIFO order
UPDATE job_stage_instances 
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = 0,
  schedule_status = 'unscheduled'
WHERE job_id = (SELECT id FROM production_jobs WHERE wo_no = 'D426514')
  AND job_table_name = 'production_jobs'
  AND status = 'pending';