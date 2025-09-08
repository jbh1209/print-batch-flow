-- Step 1: DROP existing trigger and function to start fresh
DROP TRIGGER IF EXISTS trg_sync_proof_approval_timestamps ON public.job_stage_instances;
DROP FUNCTION IF EXISTS public.sync_proof_approval_timestamps();

-- Step 2: Create bulletproof trigger function
CREATE OR REPLACE FUNCTION public.sync_proof_approval_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if proof_approved_manually_at was just set (from NULL to non-NULL)
  IF OLD.proof_approved_manually_at IS NULL AND NEW.proof_approved_manually_at IS NOT NULL THEN
    -- Update production_jobs.proof_approved_at to match
    UPDATE public.production_jobs 
    SET 
      proof_approved_at = NEW.proof_approved_manually_at,
      updated_at = now()
    WHERE id = NEW.job_id;
    
    RAISE NOTICE 'Auto-synced proof_approved_at for job % to %', NEW.job_id, NEW.proof_approved_manually_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the trigger (fresh)
CREATE TRIGGER trg_sync_proof_approval_timestamps
  AFTER UPDATE OF proof_approved_manually_at ON public.job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_proof_approval_timestamps();

-- Step 4: Test the trigger by fixing D426518
-- Find and update D426518's proof stage instance
UPDATE job_stage_instances
SET 
  proof_approved_manually_at = '2025-09-08 08:34:00.38+00'::timestamptz,
  updated_at = now()
WHERE job_id = (
  SELECT id FROM production_jobs WHERE wo_no = 'D426518'
) 
AND production_stage_id = (
  SELECT id FROM production_stages WHERE name ILIKE '%proof%' LIMIT 1
)
AND proof_approved_manually_at IS NULL;