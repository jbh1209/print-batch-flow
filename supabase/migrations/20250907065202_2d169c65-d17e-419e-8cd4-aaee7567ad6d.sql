-- Fix corrupted scheduled_minutes for job D426512
-- Reset scheduled_minutes to NULL so jsi_minutes() will use estimated_duration_minutes

UPDATE job_stage_instances 
SET 
  scheduled_minutes = NULL,
  updated_at = now()
WHERE job_id = 'D426512'
  AND COALESCE(status, '') NOT IN ('completed', 'active')
  AND scheduled_minutes = 1;