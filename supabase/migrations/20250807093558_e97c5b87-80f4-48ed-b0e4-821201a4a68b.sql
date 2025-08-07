-- Add schedule information columns to job_stage_instances table
-- This allows the scheduler to enhance existing production data rather than creating separate schedule data

ALTER TABLE public.job_stage_instances 
ADD COLUMN IF NOT EXISTS scheduled_date date,
ADD COLUMN IF NOT EXISTS queue_position integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS time_slot text,
ADD COLUMN IF NOT EXISTS scheduled_start_time time,
ADD COLUMN IF NOT EXISTS scheduled_end_time time;

-- Add index for efficient weekly calendar queries
CREATE INDEX IF NOT EXISTS idx_job_stage_instances_scheduled_date 
ON public.job_stage_instances(scheduled_date) 
WHERE scheduled_date IS NOT NULL;

-- Add index for stage and date filtering
CREATE INDEX IF NOT EXISTS idx_job_stage_instances_stage_schedule 
ON public.job_stage_instances(production_stage_id, scheduled_date) 
WHERE scheduled_date IS NOT NULL;