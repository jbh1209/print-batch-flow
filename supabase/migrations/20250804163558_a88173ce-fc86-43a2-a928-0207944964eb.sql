-- Drop the conflicting unique constraint that doesn't include part_name
ALTER TABLE public.production_job_schedules 
DROP CONSTRAINT IF EXISTS production_job_schedules_job_id_job_table_name_production_s_key;