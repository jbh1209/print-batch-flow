-- Clear broken auto-scheduler data to reset for parallel scheduler
UPDATE public.job_stage_instances 
SET 
  auto_scheduled_start_at = NULL,
  auto_scheduled_end_at = NULL,
  auto_scheduled_duration_minutes = NULL,
  schedule_status = 'unscheduled',
  updated_at = now()
WHERE job_table_name = 'production_jobs'
  AND status IN ('pending', 'active')
  AND auto_scheduled_start_at IS NOT NULL;