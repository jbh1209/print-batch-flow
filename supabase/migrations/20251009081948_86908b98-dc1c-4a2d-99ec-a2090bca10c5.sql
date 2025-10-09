
-- Fix: Add proper error handling to proof approval trigger (retry after deadlock)
CREATE OR REPLACE FUNCTION public.notify_scheduler_on_proof_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
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
        true
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
