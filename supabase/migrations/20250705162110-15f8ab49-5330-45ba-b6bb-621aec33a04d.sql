-- Phase 4: Add safeguards to prevent future stage order conflicts
-- Create a validation function to ensure stage ordering integrity

CREATE OR REPLACE FUNCTION public.validate_stage_order_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Ensure Batch Allocation always comes before Printing stages
  IF (SELECT name FROM production_stages WHERE id = NEW.production_stage_id) = 'Batch Allocation' THEN
    -- Check if there are any printing stages with lower or equal stage order in the same category
    IF EXISTS (
      SELECT 1 
      FROM category_production_stages cps
      JOIN production_stages ps ON cps.production_stage_id = ps.id
      WHERE cps.category_id = NEW.category_id
        AND ps.name ILIKE '%print%'
        AND cps.stage_order <= NEW.stage_order
        AND cps.id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Batch Allocation stage must come before all Printing stages (current order: %, but printing stages exist at or below this order)', NEW.stage_order;
    END IF;
  END IF;
  
  -- Ensure Printing stages always come after Batch Allocation
  IF (SELECT name FROM production_stages WHERE id = NEW.production_stage_id) ILIKE '%print%' THEN
    -- Check if there's a Batch Allocation stage with higher or equal stage order in the same category
    IF EXISTS (
      SELECT 1 
      FROM category_production_stages cps
      JOIN production_stages ps ON cps.production_stage_id = ps.id
      WHERE cps.category_id = NEW.category_id
        AND ps.name = 'Batch Allocation'
        AND cps.stage_order >= NEW.stage_order
        AND cps.id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Printing stages must come after Batch Allocation stage (current order: %, but Batch Allocation is at or above this order)', NEW.stage_order;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Apply the validation trigger to prevent future conflicts
DROP TRIGGER IF EXISTS validate_stage_order_integrity_trigger ON category_production_stages;
CREATE TRIGGER validate_stage_order_integrity_trigger
  BEFORE INSERT OR UPDATE ON category_production_stages
  FOR EACH ROW EXECUTE FUNCTION validate_stage_order_integrity();

-- Now improve the advance_job_to_batch_allocation function to include logging
CREATE OR REPLACE FUNCTION public.advance_job_to_batch_allocation(
  p_job_id uuid,
  p_job_table_name text DEFAULT 'production_jobs'::text,
  p_completed_by uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  proof_stage_id uuid;
  batch_allocation_stage_id uuid;
  current_proof_stage_instance_id uuid;
  job_wo_no text;
BEGIN
  -- Get job WO number for logging
  EXECUTE format('SELECT wo_no FROM %I WHERE id = $1', p_job_table_name)
  INTO job_wo_no
  USING p_job_id;
  
  -- Log the start of the process
  INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
  VALUES (p_job_id, job_wo_no, 'advance_start', 'Starting advance to batch allocation');

  -- Find the proof stage that's currently active for this job
  SELECT jsi.id, jsi.production_stage_id INTO current_proof_stage_instance_id, proof_stage_id
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_id = p_job_id
    AND jsi.job_table_name = p_job_table_name
    AND jsi.status = 'active'
    AND ps.name ILIKE '%proof%'
  LIMIT 1;
  
  IF current_proof_stage_instance_id IS NULL THEN
    INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
    VALUES (p_job_id, job_wo_no, 'error', 'No active proof stage found');
    RAISE EXCEPTION 'No active proof stage found for job %', p_job_id;
  END IF;
  
  -- Find the Batch Allocation stage
  SELECT id INTO batch_allocation_stage_id
  FROM public.production_stages
  WHERE name = 'Batch Allocation'
  LIMIT 1;
  
  IF batch_allocation_stage_id IS NULL THEN
    INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
    VALUES (p_job_id, job_wo_no, 'error', 'Batch Allocation stage not found');
    RAISE EXCEPTION 'Batch Allocation stage not found';
  END IF;
  
  -- Complete the proof stage
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = p_completed_by,
    updated_at = now()
  WHERE id = current_proof_stage_instance_id;
  
  INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
  VALUES (p_job_id, job_wo_no, 'proof_completed', 'Proof stage marked as completed');
  
  -- Activate the Batch Allocation stage
  UPDATE public.job_stage_instances
  SET 
    status = 'active',
    started_at = now(),
    started_by = p_completed_by,
    updated_at = now()
  WHERE job_id = p_job_id
    AND job_table_name = p_job_table_name
    AND production_stage_id = batch_allocation_stage_id
    AND status = 'pending';
  
  INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
  VALUES (p_job_id, job_wo_no, 'batch_stage_activated', 'Batch Allocation stage activated');
  
  -- Mark job as ready for batching
  EXECUTE format('
    UPDATE %I 
    SET 
      batch_ready = true,
      batch_allocated_at = now(),
      batch_allocated_by = $1,
      status = ''Ready for Batch'',
      updated_at = now()
    WHERE id = $2
  ', p_job_table_name)
  USING p_completed_by, p_job_id;
  
  INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
  VALUES (p_job_id, job_wo_no, 'job_marked_ready', 'Job marked as batch_ready = true');
  
  INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
  VALUES (p_job_id, job_wo_no, 'advance_complete', 'Successfully advanced to batch allocation');
  
  RETURN true;
END;
$function$;