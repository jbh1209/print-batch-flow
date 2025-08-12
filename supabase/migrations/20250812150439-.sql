-- Add split_metadata JSONB column to job_stage_instances for storing multi-day split information
ALTER TABLE public.job_stage_instances 
ADD COLUMN split_metadata JSONB DEFAULT NULL;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.job_stage_instances.split_metadata IS 'Stores multi-day split information as JSON instead of creating separate database rows for each split';