-- Restore working auto-schedule flow: call edge function instead of direct RPC
-- This matches the pattern used by "Reschedule All" which works reliably

-- 1. Update stage-level proof approval trigger to call edge function
CREATE OR REPLACE FUNCTION public.trigger_schedule_on_proof_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_proof boolean;
  v_wo_no text;
  v_url text;
  v_response record;
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
        
        RAISE NOTICE '🚀 [STAGE] Proof approval trigger for job % (WO: %)', NEW.job_id, v_wo_no;
        
        -- Call the edge function (same as Reschedule All uses)
        v_url := (SELECT current_setting('request.headers')::json->>'x-forwarded-host');
        IF v_url IS NULL OR v_url = '' THEN
          v_url := 'kgizusgqexmlfcqfjopk.supabase.co';
        END IF;
        v_url := 'https://' || v_url || '/functions/v1/schedule-on-approval';
        
        SELECT * INTO v_response FROM net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'commit', true,
            'proposed', false,
            'onlyIfUnset', true,
            'onlyJobIds', jsonb_build_array(NEW.job_id)
          )
        );
        
        RAISE NOTICE '✅ [STAGE] Edge function responded: status=%, body=%', 
          v_response.status, v_response.content;
        
        INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
        VALUES (
          NEW.job_id, 
          v_wo_no,
          'proof_approval_stage_trigger', 
          format('Called schedule-on-approval edge function. Status: %s', v_response.status::text)
        );
        
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ [STAGE] Proof approval trigger FAILED for job % (WO: %): %', 
          NEW.job_id, v_wo_no, SQLERRM;
        
        INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
        VALUES (
          NEW.job_id, 
          v_wo_no,
          'proof_approval_stage_trigger_ERROR', 
          format('FAILED: %s', SQLERRM)
        );
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Create job-level proof approval trigger (fallback for jobs without stage approval)
CREATE OR REPLACE FUNCTION public.trigger_schedule_on_job_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text;
  v_response record;
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
      
      -- Call the edge function (same as Reschedule All uses)
      v_url := (SELECT current_setting('request.headers')::json->>'x-forwarded-host');
      IF v_url IS NULL OR v_url = '' THEN
        v_url := 'kgizusgqexmlfcqfjopk.supabase.co';
      END IF;
      v_url := 'https://' || v_url || '/functions/v1/schedule-on-approval';
      
      SELECT * INTO v_response FROM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'commit', true,
          'proposed', false,
          'onlyIfUnset', true,
          'onlyJobIds', jsonb_build_array(NEW.id)
        )
      );
      
      RAISE NOTICE '✅ [JOB] Edge function responded: status=%, body=%', 
        v_response.status, v_response.content;
      
      INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        NEW.id, 
        NEW.wo_no,
        'proof_approval_job_trigger', 
        format('Called schedule-on-approval edge function. Stages: %s, Status: %s', 
          v_stage_count::text, v_response.status::text)
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
$$;

-- Drop and recreate job-level trigger
DROP TRIGGER IF EXISTS trg_schedule_on_job_approval ON public.production_jobs;

CREATE TRIGGER trg_schedule_on_job_approval
  AFTER UPDATE OF proof_approved_at ON public.production_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_schedule_on_job_approval();

COMMENT ON TRIGGER trg_schedule_on_job_approval ON public.production_jobs IS 
  'Auto-schedules jobs when proof_approved_at is set (fallback for job-level approvals)';