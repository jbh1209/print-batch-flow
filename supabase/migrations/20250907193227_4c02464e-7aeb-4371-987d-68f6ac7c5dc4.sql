-- Set D426512's proof approval timestamp to be AFTER D426502 and D426506 (proper FIFO order)
-- D426502 was approved at 2025-09-07 17:05:34
-- D426506 was approved at 2025-09-07 17:06:45
-- So D426512 should be approved AFTER D426506 to maintain FIFO order

UPDATE production_jobs 
SET 
  proof_approved_at = '2025-09-07 17:07:30'::timestamptz,
  updated_at = now()
WHERE wo_no = 'D426512';

-- Set the proof_approved_manually_at on the PROOF stage instance for D426512
UPDATE job_stage_instances 
SET 
  proof_approved_manually_at = '2025-09-07 17:07:30'::timestamptz,
  updated_at = now()
FROM production_jobs pj, production_stages ps
WHERE job_stage_instances.job_id = pj.id
  AND job_stage_instances.production_stage_id = ps.id
  AND pj.wo_no = 'D426512'
  AND ps.name ILIKE '%proof%';