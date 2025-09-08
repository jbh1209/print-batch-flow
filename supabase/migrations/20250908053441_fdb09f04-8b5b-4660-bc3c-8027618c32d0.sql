-- Create master database trigger for automatic proof approval timestamp sync
-- This ensures ALL proof approval pathways result in consistent timestamps

-- Create function to sync proof_approved_at when proof_approved_manually_at is set
CREATE OR REPLACE FUNCTION public.sync_proof_approval_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if proof_approved_manually_at was just set (from NULL to non-NULL)
  IF OLD.proof_approved_manually_at IS NULL AND NEW.proof_approved_manually_at IS NOT NULL THEN
    -- Find the job_id and update production_jobs.proof_approved_at
    UPDATE public.production_jobs 
    SET 
      proof_approved_at = NEW.proof_approved_manually_at,
      updated_at = now()
    WHERE id = NEW.job_id 
      AND proof_approved_at IS NULL; -- Only update if not already set
    
    RAISE NOTICE 'Auto-synced proof_approved_at for job % to %', NEW.job_id, NEW.proof_approved_manually_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on job_stage_instances to auto-sync timestamps
DROP TRIGGER IF EXISTS sync_proof_timestamps ON public.job_stage_instances;
CREATE TRIGGER sync_proof_timestamps
  AFTER UPDATE OF proof_approved_manually_at ON public.job_stage_instances
  FOR EACH ROW 
  EXECUTE FUNCTION public.sync_proof_approval_timestamps();