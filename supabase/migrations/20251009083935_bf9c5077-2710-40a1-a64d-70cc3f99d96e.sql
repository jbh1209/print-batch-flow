
-- Fix: Add proper error handling to trigger_schedule_on_proof_approval
-- This will catch silent failures in scheduler_append_jobs and log them

CREATE OR REPLACE FUNCTION public.trigger_schedule_on_proof_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_proof boolean;
  result record;
  v_error_msg text;
  v_wo_no text;
BEGIN
  -- Only when proof approved transitions from NULL to NOT NULL
  IF NEW.proof_approved_manually_at IS NOT NULL AND (OLD.proof_approved_manually_at IS NULL) THEN
    -- Check this stage is a Proof stage by name
    SELECT ps.name ILIKE '%proof%' INTO is_proof
    FROM public.production_stages ps
    WHERE ps.id = NEW.production_stage_id;

    IF COALESCE(is_proof, false) THEN
      BEGIN
        -- Get WO number for logging
        SELECT wo_no INTO v_wo_no FROM production_jobs WHERE id = NEW.job_id;
        
        RAISE NOTICE '🚀 Proof approval trigger starting for job % (WO: %)', NEW.job_id, v_wo_no;
        
        -- Use scheduler_append_jobs RPC directly with append-only mode
        SELECT * INTO result FROM public.scheduler_append_jobs(
          ARRAY[NEW.job_id]::uuid[],
          true  -- p_only_if_unset = true for append-only behavior
        );
        
        RAISE NOTICE '✅ Proof approval scheduler completed for job % (WO: %): wrote_slots=%, updated_jsi=%', 
          NEW.job_id, v_wo_no, result.wrote_slots, result.updated_jsi;
        
        -- Log the scheduling trigger with details
        INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
        VALUES (
          NEW.job_id, 
          v_wo_no,
          'proof_approval_trigger_append', 
          format('Appended job after proof approval. Slots: %s, Stages: %s', 
            COALESCE(result.wrote_slots::text, '0'),
            COALESCE(result.updated_jsi::text, '0'))
        );
        
      EXCEPTION WHEN OTHERS THEN
        v_error_msg := SQLERRM;
        RAISE WARNING '❌ Proof approval scheduler FAILED for job % (WO: %): %', NEW.job_id, v_wo_no, v_error_msg;
        
        -- Log the error so we can debug it
        INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
        VALUES (
          NEW.job_id, 
          v_wo_no,
          'proof_approval_trigger_ERROR', 
          format('FAILED to append job: %s', v_error_msg)
        );
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Verify the function was updated
DO $$
BEGIN
  RAISE NOTICE '✅ trigger_schedule_on_proof_approval updated with error handling';
END $$;
