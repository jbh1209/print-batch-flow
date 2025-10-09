-- Drop conflicting stage-level scheduling triggers to prevent race conditions
-- Only job-level approval trigger should invoke scheduler

DROP TRIGGER IF EXISTS trg_schedule_on_proof_approval ON public.job_stage_instances;
DROP TRIGGER IF EXISTS trg_schedule_when_proof_completed ON public.job_stage_instances;

-- Add lightweight guard to job-level scheduler to prevent re-entry
CREATE OR REPLACE FUNCTION public.trigger_schedule_on_job_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result record;
  v_stage_count integer;
  v_lock_acquired boolean;
BEGIN
  -- Only when proof_approved_at transitions from NULL to NOT NULL
  IF NEW.proof_approved_at IS NOT NULL AND (OLD.proof_approved_at IS NULL OR OLD.proof_approved_at IS DISTINCT FROM NEW.proof_approved_at) THEN
    BEGIN
      -- Advisory lock to prevent concurrent scheduling of same job
      v_lock_acquired := pg_try_advisory_xact_lock(hashtext('schedule_job_' || NEW.id::text));
      
      IF NOT v_lock_acquired THEN
        RAISE NOTICE '⏭️ [JOB] Skipping auto-schedule for job % (WO: %) - already being scheduled', 
          NEW.id, NEW.wo_no;
        RETURN NEW;
      END IF;
      
      -- Check if job has stages
      SELECT COUNT(*) INTO v_stage_count
      FROM job_stage_instances
      WHERE job_id = NEW.id AND job_table_name = 'production_jobs';
      
      -- Skip custom workflow jobs with no stages
      IF v_stage_count = 0 AND NEW.has_custom_workflow = true THEN
        RAISE NOTICE '⏭️ [JOB] Skipping auto-schedule for custom workflow job % (WO: %) with no stages', 
          NEW.id, NEW.wo_no;
        
        INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
        VALUES (
          NEW.id, 
          NEW.wo_no,
          'job_approval_skipped_custom_workflow', 
          'Custom workflow job with no stages - manual scheduling required'
        );
        
        RETURN NEW;
      END IF;
      
      RAISE NOTICE '🚀 [JOB] Proof approval trigger for job % (WO: %) - %s stages', 
        NEW.id, NEW.wo_no, v_stage_count;
      
      -- Call scheduler_append_jobs directly with append-only mode
      SELECT * INTO v_result 
      FROM public.scheduler_append_jobs(
        p_job_ids := ARRAY[NEW.id],
        p_only_if_unset := true
      );
      
      RAISE NOTICE '✅ [JOB] Scheduler completed: % slots written, % stages updated', 
        v_result.wrote_slots, v_result.updated_jsi;
      
      INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        NEW.id, 
        NEW.wo_no,
        'proof_approval_job_trigger', 
        format('Direct scheduler_append_jobs: wrote %s slots, updated %s stages. Stages count: %s', 
          v_result.wrote_slots, v_result.updated_jsi, v_stage_count)
      );
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ [JOB] Proof approval trigger FAILED for job % (WO: %): %', 
        NEW.id, NEW.wo_no, SQLERRM;
      
      INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        NEW.id, 
        NEW.wo_no,
        'proof_approval_job_trigger_ERROR', 
        format('FAILED: %s', SQLERRM)
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;