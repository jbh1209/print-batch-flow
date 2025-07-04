-- Function to manually activate batch allocation for jobs that have completed proof
CREATE OR REPLACE FUNCTION public.activate_batch_allocation_for_job(
  p_job_id uuid,
  p_job_table_name text DEFAULT 'production_jobs'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_allocation_stage_id uuid;
BEGIN
  -- Find the Batch Allocation stage
  SELECT id INTO batch_allocation_stage_id
  FROM public.production_stages
  WHERE name = 'Batch Allocation'
  LIMIT 1;
  
  IF batch_allocation_stage_id IS NULL THEN
    RAISE EXCEPTION 'Batch Allocation stage not found';
  END IF;
  
  -- Activate the Batch Allocation stage
  UPDATE public.job_stage_instances
  SET 
    status = 'active',
    started_at = now(),
    started_by = auth.uid(),
    updated_at = now()
  WHERE job_id = p_job_id
    AND job_table_name = p_job_table_name
    AND production_stage_id = batch_allocation_stage_id
    AND status = 'pending';
  
  -- Mark job as ready for batching but preserve original WO number
  UPDATE public.production_jobs
  SET 
    batch_ready = true,
    batch_allocated_at = now(),
    batch_allocated_by = auth.uid(),
    status = 'Ready for Batch',
    updated_at = now()
  WHERE id = p_job_id;
  
  RETURN true;
END;
$$;