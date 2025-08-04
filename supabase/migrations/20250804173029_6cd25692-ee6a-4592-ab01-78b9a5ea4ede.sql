-- Phase 1: Remove conflicting production_job_schedules table
DROP TABLE IF EXISTS public.production_job_schedules CASCADE;

-- Phase 2: Enhance production_jobs table with scheduling fields
ALTER TABLE public.production_jobs 
ADD COLUMN IF NOT EXISTS scheduled_date date,
ADD COLUMN IF NOT EXISTS queue_position integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS estimated_start_date date,
ADD COLUMN IF NOT EXISTS estimated_completion_date date,
ADD COLUMN IF NOT EXISTS scheduling_priority integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS last_scheduled_at timestamp with time zone;

-- Add index for efficient scheduling queries
CREATE INDEX IF NOT EXISTS idx_production_jobs_scheduled_date 
ON public.production_jobs(scheduled_date, queue_position) 
WHERE scheduled_date IS NOT NULL;

-- Add index for priority-based queries
CREATE INDEX IF NOT EXISTS idx_production_jobs_scheduling_priority 
ON public.production_jobs(scheduling_priority, due_date, created_at);