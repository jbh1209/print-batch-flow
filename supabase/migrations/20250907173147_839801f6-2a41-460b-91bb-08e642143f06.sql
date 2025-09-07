-- Fix D426512 scheduling by setting proper proof approval timestamp and clearing incorrect schedule

-- Clear the existing incorrect schedule for D426512
UPDATE job_stage_instances 
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL, 
  scheduled_minutes = NULL,
  updated_at = now()
WHERE job_id IN (
  SELECT id FROM production_jobs WHERE wo_no = 'D426512'
)
AND job_table_name = 'production_jobs'
AND status = 'pending';

-- Set proof approval timestamp for D426512 (approved after D426506)
-- This should be later than D426506's timestamp (14:37:45) to maintain FIFO order
UPDATE production_jobs 
SET 
  proof_approved_at = '2025-09-07 17:06:34'::timestamptz,
  updated_at = now()
WHERE wo_no = 'D426512';

-- Set the proof_approved_manually_at on the PROOF stage instance for D426512
UPDATE job_stage_instances 
SET 
  proof_approved_manually_at = '2025-09-07 17:06:34'::timestamptz,
  updated_at = now()
FROM production_jobs pj, production_stages ps
WHERE job_stage_instances.job_id = pj.id
  AND job_stage_instances.production_stage_id = ps.id
  AND pj.wo_no = 'D426512'
  AND ps.name ILIKE '%proof%';