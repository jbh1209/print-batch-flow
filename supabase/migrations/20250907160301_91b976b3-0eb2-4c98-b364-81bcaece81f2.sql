-- Clean up corrupted scheduled_minutes data caused by the 1-minute bug
-- This updates all JSI records where scheduled_minutes is clearly wrong (1 minute)
-- and resets them to use estimated_duration_minutes instead

UPDATE job_stage_instances 
SET 
  scheduled_minutes = NULL,
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  updated_at = now()
WHERE scheduled_minutes = 1
  AND estimated_duration_minutes IS NOT NULL 
  AND estimated_duration_minutes > 1;