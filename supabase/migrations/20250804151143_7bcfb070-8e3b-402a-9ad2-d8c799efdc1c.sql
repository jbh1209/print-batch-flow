-- Add part_name column to production_job_schedules table
ALTER TABLE public.production_job_schedules 
ADD COLUMN part_name text;

-- Drop the existing unique constraint if it exists
ALTER TABLE public.production_job_schedules 
DROP CONSTRAINT IF EXISTS production_job_schedules_job_id_production_stage_id_schedul_key;

-- Create new unique constraint that includes part_name (using expression index approach)
CREATE UNIQUE INDEX production_job_schedules_unique_schedule_idx 
ON public.production_job_schedules (job_id, job_table_name, production_stage_id, scheduled_date, COALESCE(part_name, ''));

-- Update existing schedule entries to include part_name from job_stage_instances
UPDATE public.production_job_schedules pjs
SET part_name = jsi.part_name
FROM public.job_stage_instances jsi
WHERE pjs.job_id = jsi.job_id 
  AND pjs.job_table_name = jsi.job_table_name
  AND pjs.production_stage_id = jsi.production_stage_id
  AND jsi.part_name IS NOT NULL;