-- Restore missing trigger infrastructure for manual proof approvals
-- This was accidentally dropped in division cleanup migration

-- 1. Create the function for production_jobs table
CREATE OR REPLACE FUNCTION public.notify_scheduler_on_proof_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result record;
  v_error_msg text;
BEGIN
  IF NEW.proof_approved_at IS NOT NULL AND (OLD.proof_approved_at IS NULL) THEN
    BEGIN
      RAISE NOTICE '🚀 Job proof approval trigger starting for job % (WO: %)', NEW.id, NEW.wo_no;
      
      SELECT * INTO result FROM public.scheduler_append_jobs(
        ARRAY[NEW.id]::uuid[],
        true  -- only_if_unset
      );
      
      RAISE NOTICE '✅ Scheduler append completed for job %: wrote_slots=%, updated_jsi=%', 
        NEW.wo_no, result.wrote_slots, result.updated_jsi;
      
      INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        NEW.id, 
        NEW.wo_no, 
        'job_proof_approval_append', 
        format('Appended job. Slots: %s, Stages: %s', 
          COALESCE(result.wrote_slots::text, '0'), 
          COALESCE(result.updated_jsi::text, '0'))
      );
      
    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      RAISE WARNING '❌ Scheduler append FAILED for job % (WO: %): %', NEW.id, NEW.wo_no, v_error_msg;
      
      INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        NEW.id, 
        NEW.wo_no, 
        'job_proof_approval_append_ERROR', 
        format('FAILED: %s', v_error_msg)
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Create the trigger on production_jobs table
DROP TRIGGER IF EXISTS trg_schedule_on_approval ON public.production_jobs;

CREATE TRIGGER trg_schedule_on_approval
  AFTER UPDATE OF proof_approved_at ON public.production_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_scheduler_on_proof_approval();

COMMENT ON TRIGGER trg_schedule_on_approval ON public.production_jobs IS 
  'Auto-schedules jobs when proof_approved_at is set (synced from job_stage_instances manual approvals)';

-- 3. Test with the two jobs that failed earlier - force trigger re-fire
UPDATE production_jobs 
SET proof_approved_at = proof_approved_at 
WHERE wo_no IN ('D427280', 'D427289')
  AND proof_approved_at IS NOT NULL;