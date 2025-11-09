-- Add job_stage_instances and production_jobs to realtime publication
-- Note: This will error if already added, but that's safe to ignore
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_stage_instances;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.production_jobs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Set REPLICA IDENTITY FULL for better realtime updates
ALTER TABLE public.job_stage_instances REPLICA IDENTITY FULL;
ALTER TABLE public.production_jobs REPLICA IDENTITY FULL;