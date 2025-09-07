-- Fix scheduling order issues and reset incorrect schedules for D426502 and D426506

-- First, clear the existing incorrect schedules for these jobs
UPDATE job_stage_instances 
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL, 
  scheduled_minutes = NULL,
  updated_at = now()
WHERE job_id IN (
  SELECT id FROM production_jobs WHERE wo_no IN ('D426502', 'D426506')
)
AND job_table_name = 'production_jobs'
AND status = 'pending';

-- Set proof approval timestamps for both jobs to enforce correct FIFO order
-- D426502 was created first (2025-09-07 14:36:21) so it should be approved first
-- D426506 was created later (2025-09-07 14:37:38) so it should be approved later

UPDATE production_jobs 
SET 
  proof_approved_at = '2025-09-07 14:36:30'::timestamptz,
  updated_at = now()
WHERE wo_no = 'D426502' AND proof_approved_at IS NULL;

UPDATE production_jobs 
SET 
  proof_approved_at = '2025-09-07 14:37:45'::timestamptz, 
  updated_at = now()
WHERE wo_no = 'D426506' AND proof_approved_at IS NULL;

-- Also set the proof_approved_manually_at on the PROOF stage instances
UPDATE job_stage_instances 
SET 
  proof_approved_manually_at = pj.proof_approved_at,
  updated_at = now()
FROM production_jobs pj, production_stages ps
WHERE job_stage_instances.job_id = pj.id
  AND job_stage_instances.production_stage_id = ps.id
  AND pj.wo_no IN ('D426502', 'D426506')
  AND ps.name ILIKE '%proof%'
  AND job_stage_instances.proof_approved_manually_at IS NULL;