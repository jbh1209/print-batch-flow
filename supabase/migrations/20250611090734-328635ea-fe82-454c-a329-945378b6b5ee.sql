
-- Mark all non-completed production jobs as completed
-- This will prevent duplication issues when importing new data

UPDATE production_jobs 
SET 
  status = 'Completed',
  updated_at = now()
WHERE status != 'Completed' 
  OR status IS NULL;

-- Also mark any associated job stage instances as completed
UPDATE job_stage_instances 
SET 
  status = 'completed',
  completed_at = now(),
  completed_by = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1), -- Use first available user
  updated_at = now()
WHERE job_table_name = 'production_jobs'
  AND job_id IN (
    SELECT id FROM production_jobs 
    WHERE status = 'Completed'
  )
  AND status != 'completed';
