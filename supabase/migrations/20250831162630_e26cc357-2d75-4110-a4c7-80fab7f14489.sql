-- Add foreign key constraint between job_stage_instances and production_jobs
ALTER TABLE public.job_stage_instances 
ADD CONSTRAINT fk_job_stage_instances_production_jobs 
FOREIGN KEY (job_id) REFERENCES public.production_jobs(id) ON DELETE CASCADE;