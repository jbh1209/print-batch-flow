-- Create production job schedules table for persistent schedule management
CREATE TABLE IF NOT EXISTS public.production_job_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  job_table_name TEXT NOT NULL DEFAULT 'production_jobs',
  production_stage_id UUID NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  queue_position INTEGER NOT NULL DEFAULT 0,
  shift_number INTEGER NOT NULL DEFAULT 1,
  estimated_duration_minutes INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  UNIQUE(job_id, job_table_name, production_stage_id, scheduled_date),
  CHECK (shift_number BETWEEN 1 AND 3),
  CHECK (queue_position >= 0)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_production_job_schedules_date_stage ON public.production_job_schedules(scheduled_date, production_stage_id);
CREATE INDEX IF NOT EXISTS idx_production_job_schedules_job ON public.production_job_schedules(job_id, job_table_name);
CREATE INDEX IF NOT EXISTS idx_production_job_schedules_queue ON public.production_job_schedules(production_stage_id, scheduled_date, queue_position);

-- Enable RLS
ALTER TABLE public.production_job_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view production schedules" 
ON public.production_job_schedules 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage production schedules" 
ON public.production_job_schedules 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Add trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_production_schedule_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_production_schedules_timestamp
  BEFORE UPDATE ON public.production_job_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_production_schedule_timestamp();

-- Function to update production schedules nightly
CREATE OR REPLACE FUNCTION public.update_production_schedules_nightly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Move completed jobs to next stages and update queue positions
  -- This will be called by a nightly cron job or edge function
  
  -- Update queue positions for remaining jobs
  WITH ordered_jobs AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY production_stage_id, scheduled_date, shift_number 
        ORDER BY queue_position, created_at
      ) as new_position
    FROM public.production_job_schedules
    WHERE scheduled_date >= CURRENT_DATE
  )
  UPDATE public.production_job_schedules pjs
  SET 
    queue_position = oj.new_position,
    updated_at = now()
  FROM ordered_jobs oj
  WHERE pjs.id = oj.id
    AND pjs.queue_position != oj.new_position;
    
  -- Log the update
  RAISE NOTICE 'Production schedules updated at %', now();
END;
$$;

-- Comment for documentation
COMMENT ON TABLE public.production_job_schedules IS 'Persistent production schedule storage - single source of truth for job scheduling';