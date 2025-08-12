-- PHASE 1: DATABASE CLEANUP & RESET
-- Clear all broken schedules from job_stage_instances
UPDATE public.job_stage_instances 
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  updated_at = now()
WHERE scheduled_start_at IS NOT NULL OR scheduled_end_at IS NOT NULL;

-- Clear stage_workload_tracking table completely
DELETE FROM public.stage_workload_tracking;

-- Clear daily_stage_capacity table completely  
DELETE FROM public.daily_stage_capacity;

-- Reset all jobs with impossible schedules to proper pending status
UPDATE public.job_stage_instances
SET 
  status = 'pending',
  started_at = NULL,
  started_by = NULL,
  updated_at = now()
WHERE status = 'active' 
  AND (scheduled_start_at IS NULL OR scheduled_end_at IS NULL);

-- Reset tentative due dates that were calculated with broken engine
UPDATE public.production_jobs
SET 
  tentative_due_date = NULL,
  internal_completion_date = NULL,
  due_date_warning_level = 'green',
  updated_at = now()
WHERE tentative_due_date IS NOT NULL OR internal_completion_date IS NOT NULL;