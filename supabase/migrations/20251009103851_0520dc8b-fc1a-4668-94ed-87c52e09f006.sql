-- Restore direct scheduler_append_jobs call in proof approval triggers
-- This was the working approach before the edge function proxy was introduced

CREATE OR REPLACE FUNCTION public.trigger_schedule_on_proof_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result record;
  v_stage_count integer;
BEGIN
  -- Only when proof_approved_manually_at transitions from NULL to NOT NULL
  IF NEW.proof_approved_manually_at IS NOT NULL AND (OLD.proof_approved_manually_at IS NULL OR OLD.proof_approved_manually_at IS DISTINCT FROM NEW.proof_approved_manually_at) THEN
    BEGIN
      RAISE NOTICE '🚀 [STAGE] Proof approval trigger for stage % of job %', NEW.id, NEW.job_id;
      
      -- Call scheduler_append_jobs directly with append-only mode
      SELECT * INTO v_result 
      FROM public.scheduler_append_jobs(
        p_job_ids := ARRAY[NEW.job_id],
        p_only_if_unset := true
      );
      
      RAISE NOTICE '✅ [STAGE] Scheduler completed: % slots written, % stages updated', 
        v_result.wrote_slots, v_result.updated_jsi;
      
      INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
      SELECT 
        NEW.job_id,
        pj.wo_no,
        'proof_approval_stage_trigger',
        format('Direct scheduler_append_jobs: wrote %s slots, updated %s stages', 
          v_result.wrote_slots, v_result.updated_jsi)
      FROM production_jobs pj WHERE pj.id = NEW.job_id;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ [STAGE] Proof approval trigger FAILED for stage % of job %: %', 
        NEW.id, NEW.job_id, SQLERRM;
      
      INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
      SELECT 
        NEW.job_id,
        pj.wo_no,
        'proof_approval_stage_trigger_ERROR',
        format('FAILED: %s', SQLERRM)
      FROM production_jobs pj WHERE pj.id = NEW.job_id;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_schedule_on_job_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result record;
  v_stage_count integer;
BEGIN
  -- Only when proof_approved_at transitions from NULL to NOT NULL
  IF NEW.proof_approved_at IS NOT NULL AND (OLD.proof_approved_at IS NULL OR OLD.proof_approved_at IS DISTINCT FROM NEW.proof_approved_at) THEN
    BEGIN
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