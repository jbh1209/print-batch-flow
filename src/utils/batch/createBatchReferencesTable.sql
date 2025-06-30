
-- Create the batch_job_references table to link production jobs with batch jobs
-- This prevents duplicate job creation and maintains proper relationships

CREATE TABLE IF NOT EXISTS public.batch_job_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_job_id UUID NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  batch_job_table TEXT NOT NULL,
  batch_job_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(production_job_id, batch_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_batch_job_references_production_job_id ON public.batch_job_references(production_job_id);
CREATE INDEX IF NOT EXISTS idx_batch_job_references_batch_id ON public.batch_job_references(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_job_references_status ON public.batch_job_references(status);

-- Enable RLS (if needed)
ALTER TABLE public.batch_job_references ENABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE public.batch_job_references IS 'Links production jobs to batch processing without creating duplicates';
