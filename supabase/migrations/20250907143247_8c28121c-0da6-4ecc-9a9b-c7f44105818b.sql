-- Fix the schedule-on-approval trigger to use the correct scheduler function
-- The trigger exists but may be calling a non-existent edge function

-- Update the trigger function to use the correct scheduler
CREATE OR REPLACE FUNCTION public.trigger_schedule_on_proof_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_proof boolean;
  req_id uuid;
BEGIN
  -- Only when proof approved transitions from NULL to NOT NULL
  IF NEW.proof_approved_manually_at IS NOT NULL AND (OLD.proof_approved_manually_at IS NULL) THEN
    -- Check this stage is a Proof stage by name
    SELECT ps.name ILIKE '%proof%' INTO is_proof
    FROM public.production_stages ps
    WHERE ps.id = NEW.production_stage_id;

    IF COALESCE(is_proof, false) THEN
      -- Call the scheduler wrapper function directly instead of edge function
      PERFORM public.simple_scheduler_wrapper('reschedule_all');
      
      -- Log the scheduling trigger
      INSERT INTO public.batch_allocation_logs (job_id, action, details)
      VALUES (NEW.job_id, 'proof_approval_trigger', 'Triggered scheduler after proof approval');
      
      RAISE NOTICE 'Proof approval trigger fired for job %, calling scheduler', NEW.job_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Also create a trigger for when production_jobs.proof_approved_at is updated
CREATE OR REPLACE FUNCTION public.trigger_schedule_on_job_proof_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req_id uuid;
BEGIN
  -- Only when proof approved transitions from NULL to NOT NULL
  IF NEW.proof_approved_at IS NOT NULL AND (OLD.proof_approved_at IS NULL) THEN
    -- Call the scheduler wrapper function directly
    PERFORM public.simple_scheduler_wrapper('reschedule_all');
    
    -- Log the scheduling trigger
    INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
    VALUES (NEW.id, NEW.wo_no, 'job_proof_approval_trigger', 'Triggered scheduler after job proof approval');
    
    RAISE NOTICE 'Job proof approval trigger fired for job %, calling scheduler', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on production_jobs if it doesn't exist
DROP TRIGGER IF EXISTS trg_schedule_on_job_proof_approval ON public.production_jobs;
CREATE TRIGGER trg_schedule_on_job_proof_approval
  AFTER UPDATE ON public.production_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_schedule_on_job_proof_approval();