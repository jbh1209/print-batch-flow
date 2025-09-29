-- Fix proof approval triggers to use append-only scheduling instead of full reschedules

-- 1. Update trigger_schedule_on_proof_approval to use scheduler_append_jobs RPC directly
CREATE OR REPLACE FUNCTION public.trigger_schedule_on_proof_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  is_proof boolean;
  result record;
BEGIN
  -- Only when proof approved transitions from NULL to NOT NULL
  IF NEW.proof_approved_manually_at IS NOT NULL AND (OLD.proof_approved_manually_at IS NULL) THEN
    -- Check this stage is a Proof stage by name
    SELECT ps.name ILIKE '%proof%' INTO is_proof
    FROM public.production_stages ps
    WHERE ps.id = NEW.production_stage_id;

    IF COALESCE(is_proof, false) THEN
      -- Use scheduler_append_jobs RPC directly with append-only mode
      SELECT * INTO result FROM public.scheduler_append_jobs(
        ARRAY[NEW.job_id]::uuid[],
        true  -- p_only_if_unset = true for append-only behavior
      );
      
      -- Log the scheduling trigger
      INSERT INTO public.batch_allocation_logs (job_id, action, details)
      VALUES (NEW.job_id, 'proof_approval_trigger_append', 'Appended job to schedule after proof approval');
      
      RAISE NOTICE 'Proof approval trigger fired for job % - appended to schedule', NEW.job_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Update notify_scheduler_on_proof_approval to use scheduler_append_jobs RPC directly
CREATE OR REPLACE FUNCTION public.notify_scheduler_on_proof_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result record;
BEGIN
  -- Only when proof approved transitions from NULL to NOT NULL
  IF NEW.proof_approved_at IS NOT NULL AND (OLD.proof_approved_at IS NULL) THEN
    -- Use scheduler_append_jobs RPC directly with append-only mode
    SELECT * INTO result FROM public.scheduler_append_jobs(
      ARRAY[NEW.id]::uuid[],
      true  -- p_only_if_unset = true for append-only behavior
    );
    
    -- Log the scheduling trigger
    INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
    VALUES (NEW.id, NEW.wo_no, 'job_proof_approval_append', 'Appended job to schedule after job proof approval');
    
    RAISE NOTICE 'Job proof approval trigger fired for job % - appended to schedule', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;