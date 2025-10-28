-- Create trigger function to schedule jobs when proof stage is completed
-- This provides database-level redundancy for operator approval path
CREATE OR REPLACE FUNCTION public.trg_fn_schedule_on_proof_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_division TEXT;
  v_stage_name TEXT;
BEGIN
  -- Only proceed if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    
    -- Check if this is a PROOF stage
    SELECT ps.name INTO v_stage_name
    FROM public.production_stages ps
    WHERE ps.id = NEW.production_stage_id;
    
    IF v_stage_name ILIKE '%proof%' THEN
      -- Fetch job division for division-aware scheduling
      SELECT division INTO v_job_division
      FROM public.production_jobs
      WHERE id = NEW.job_id;
      
      -- Append this job to production schedule with division awareness
      PERFORM public.scheduler_append_jobs(
        ARRAY[NEW.job_id]::uuid[],
        true,  -- onlyIfUnset
        v_job_division
      );
      
      RAISE NOTICE 'Scheduled job % (division: %) after proof approval', NEW.job_id, COALESCE(v_job_division, 'null');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on job_stage_instances
DROP TRIGGER IF EXISTS trg_schedule_on_proof_approval ON public.job_stage_instances;
CREATE TRIGGER trg_schedule_on_proof_approval
  AFTER UPDATE OF status ON public.job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_schedule_on_proof_approval();