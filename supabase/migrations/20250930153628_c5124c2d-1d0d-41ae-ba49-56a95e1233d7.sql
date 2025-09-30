-- Phase 1: Due Date Recalculation from Schedule
-- Creates function and trigger to automatically update production_jobs.due_date
-- based on the last stage's scheduled_end_at + 1 working day buffer

-- Function to recalculate job due date from schedule
CREATE OR REPLACE FUNCTION public.recalculate_job_due_date_from_schedule(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_last_stage_end timestamptz;
  v_calculated_due_date timestamptz;
  v_current_due_date date;
  v_proof_approved_at timestamptz;
  v_original_committed date;
BEGIN
  -- Get the latest scheduled_end_at for this job
  SELECT MAX(scheduled_end_at) INTO v_last_stage_end
  FROM job_stage_instances
  WHERE job_id = p_job_id
    AND job_table_name = 'production_jobs'
    AND scheduled_end_at IS NOT NULL;
  
  -- If no scheduled stages found, exit early
  IF v_last_stage_end IS NULL THEN
    RETURN;
  END IF;
  
  -- Add 1 working day buffer using existing function
  v_calculated_due_date := public.add_working_days_to_timestamp(v_last_stage_end, 1);
  
  -- Get current due_date and proof approval status
  SELECT due_date::date, proof_approved_at, original_committed_due_date
  INTO v_current_due_date, v_proof_approved_at, v_original_committed
  FROM production_jobs
  WHERE id = p_job_id;
  
  -- If original_committed_due_date is NULL and job is approved, capture current due_date as original
  IF v_original_committed IS NULL AND v_proof_approved_at IS NOT NULL AND v_current_due_date IS NOT NULL THEN
    UPDATE production_jobs
    SET 
      original_committed_due_date = v_current_due_date,
      due_date = v_calculated_due_date::date,
      updated_at = now()
    WHERE id = p_job_id;
    
    RAISE NOTICE 'Job % - Set original_committed_due_date to % and new due_date to %', 
      p_job_id, v_current_due_date, v_calculated_due_date::date;
  ELSE
    -- Just update the due_date
    UPDATE production_jobs
    SET 
      due_date = v_calculated_due_date::date,
      updated_at = now()
    WHERE id = p_job_id;
    
    RAISE NOTICE 'Job % - Updated due_date to %', p_job_id, v_calculated_due_date::date;
  END IF;
END;
$function$;

-- Trigger function to call recalculation when schedule changes
CREATE OR REPLACE FUNCTION public.trigger_due_date_recalc_on_schedule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only recalculate if scheduled_end_at actually changed
  IF NEW.scheduled_end_at IS DISTINCT FROM OLD.scheduled_end_at THEN
    -- Call recalculation function asynchronously to not block scheduler
    PERFORM public.recalculate_job_due_date_from_schedule(NEW.job_id);
    RAISE NOTICE 'Triggered due date recalculation for job % after schedule change', NEW.job_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on job_stage_instances
DROP TRIGGER IF EXISTS trg_update_due_date_on_schedule_change ON job_stage_instances;

CREATE TRIGGER trg_update_due_date_on_schedule_change
  AFTER UPDATE OF scheduled_end_at ON job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION trigger_due_date_recalc_on_schedule_change();

COMMENT ON FUNCTION public.recalculate_job_due_date_from_schedule IS 
  'Recalculates production_jobs.due_date based on last stage scheduled_end_at + 1 working day. Captures original_committed_due_date on first calculation after proof approval.';

COMMENT ON TRIGGER trg_update_due_date_on_schedule_change ON job_stage_instances IS
  'Automatically updates job due_date when any stage schedule changes';