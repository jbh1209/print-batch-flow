-- STEP 1: Fix Data Integrity - Update schedule_status for auto-scheduled jobs
UPDATE job_stage_instances 
SET schedule_status = 'auto_scheduled', 
    updated_at = now()
WHERE auto_scheduled_start_at IS NOT NULL 
  AND (schedule_status IS NULL OR schedule_status = 'unscheduled');