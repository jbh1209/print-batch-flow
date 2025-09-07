-- URGENT: Revert D426512 changes to restore T250 queue flow
-- This should eliminate the day-long gap in the T250 queue

-- Step 1: Clear D426512's current schedule completely
DELETE FROM stage_time_slots 
WHERE job_id IN (
  SELECT id FROM production_jobs WHERE wo_no = 'D426512'
);

-- Step 2: Clear scheduled times from job_stage_instances for D426512
UPDATE job_stage_instances 
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL, 
  scheduled_minutes = NULL,
  updated_at = now()
WHERE job_id IN (
  SELECT id FROM production_jobs WHERE wo_no = 'D426512'
)
AND job_table_name = 'production_jobs';

-- Step 3: Reset proof_approved_at to NULL temporarily to remove from scheduling
UPDATE production_jobs 
SET 
  proof_approved_at = NULL,
  updated_at = now()
WHERE wo_no = 'D426512';

-- Step 4: Clear proof_approved_manually_at on the PROOF stage instance for D426512
UPDATE job_stage_instances 
SET 
  proof_approved_manually_at = NULL,
  updated_at = now()
FROM production_jobs pj, production_stages ps
WHERE job_stage_instances.job_id = pj.id
  AND job_stage_instances.production_stage_id = ps.id
  AND pj.wo_no = 'D426512'
  AND ps.name ILIKE '%proof%';