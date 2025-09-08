-- Step 1: Create the missing trigger that syncs proof approval timestamps
-- This trigger fires when proof_approved_manually_at is updated from NULL to a timestamp
-- and automatically syncs it to production_jobs.proof_approved_at

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

-- Create the trigger on job_stage_instances table
CREATE TRIGGER trg_sync_proof_approval_timestamps
  AFTER UPDATE OF proof_approved_manually_at ON public.job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_proof_approval_timestamps();

-- Step 2: Fix D426518 by setting proof_approved_manually_at (trigger will sync production_jobs)
-- First find the proof stage instance for D426518
WITH d426518_proof_stage AS (
  SELECT jsi.id as stage_instance_id, jsi.job_id
  FROM job_stage_instances jsi
  JOIN production_jobs pj ON pj.id = jsi.job_id
  JOIN production_stages ps ON ps.id = jsi.production_stage_id
  WHERE pj.wo_no = 'D426518'
    AND ps.name ILIKE '%proof%'
    AND jsi.proof_approved_manually_at IS NULL
  LIMIT 1
)
UPDATE job_stage_instances
SET 
  proof_approved_manually_at = '2025-09-08 08:34:00.38+00'::timestamptz,
  updated_at = now()
FROM d426518_proof_stage
WHERE job_stage_instances.id = d426518_proof_stage.stage_instance_id;