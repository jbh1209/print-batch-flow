-- Add orchestration columns to production_jobs table for queue-based scheduling
ALTER TABLE public.production_jobs 
ADD COLUMN proof_approved_at timestamp with time zone,
ADD COLUMN production_ready boolean DEFAULT false,
ADD COLUMN queue_calculated_due_date date,
ADD COLUMN last_queue_recalc_at timestamp with time zone;

-- Create index for efficient queue sorting by proof approval time
CREATE INDEX idx_production_jobs_proof_approved_at 
ON public.production_jobs (proof_approved_at) 
WHERE proof_approved_at IS NOT NULL;

-- Create index for production ready jobs
CREATE INDEX idx_production_jobs_production_ready 
ON public.production_jobs (production_ready) 
WHERE production_ready = true;

-- Update calculate_daily_schedules constraint to include due_date_calculation
ALTER TABLE public.schedule_calculation_log 
DROP CONSTRAINT schedule_calculation_log_calculation_type_check;

ALTER TABLE public.schedule_calculation_log 
ADD CONSTRAINT schedule_calculation_log_calculation_type_check 
CHECK (calculation_type = ANY (ARRAY['nightly_full'::text, 'job_update'::text, 'capacity_change'::text, 'manual_reschedule'::text, 'initial_population'::text, 'due_date_calculation'::text, 'proof_completion'::text]));

-- Function to automatically set proof_approved_at when proof stage completes
CREATE OR REPLACE FUNCTION public.auto_set_proof_approved_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a proof stage completion
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    -- Check if this stage is a proof stage
    IF EXISTS (
      SELECT 1 FROM public.production_stages ps 
      WHERE ps.id = NEW.production_stage_id 
      AND ps.name ILIKE '%proof%'
    ) THEN
      -- Update the production job with proof approval timestamp
      UPDATE public.production_jobs 
      SET 
        proof_approved_at = now(),
        production_ready = true,
        last_queue_recalc_at = now(),
        updated_at = now()
      WHERE id = NEW.job_id 
      AND job_table_name = NEW.job_table_name;
      
      -- Log the proof completion event
      INSERT INTO public.schedule_calculation_log (
        calculation_type, 
        trigger_reason, 
        created_by,
        started_at
      ) VALUES (
        'proof_completion',
        format('Job %s proof stage completed - ready for production queue', NEW.job_id),
        NEW.completed_by,
        now()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic proof approval detection
DROP TRIGGER IF EXISTS trigger_auto_proof_approval ON public.job_stage_instances;
CREATE TRIGGER trigger_auto_proof_approval
  AFTER UPDATE ON public.job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_proof_approved_timestamp();