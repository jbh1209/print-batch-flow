-- Create function to reorder jobs within master queues while preserving subsidiary stage relationships
CREATE OR REPLACE FUNCTION public.reorder_jobs_in_master_queue(
  p_job_reorders jsonb, -- Array of {job_id: uuid, new_order: integer}
  p_master_queue_stage_id uuid,
  p_reordered_by uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  job_reorder RECORD;
BEGIN
  -- Update job order for all jobs in the reorder list
  FOR job_reorder IN 
    SELECT 
      (value->>'job_id')::uuid as job_id,
      (value->>'new_order')::integer as new_order
    FROM jsonb_array_elements(p_job_reorders)
  LOOP
    -- Update job_order_in_stage for all stage instances of this job
    -- This ensures multi-part jobs maintain consistent ordering across subsidiary stages
    UPDATE public.job_stage_instances
    SET 
      job_order_in_stage = job_reorder.new_order,
      updated_at = now()
    WHERE job_id = job_reorder.job_id
      AND job_table_name = 'production_jobs'
      AND (
        production_stage_id = p_master_queue_stage_id OR 
        production_stage_id IN (
          SELECT id FROM public.production_stages 
          WHERE master_queue_id = p_master_queue_stage_id
        )
      );
  END LOOP;

  -- Log job reordering activity
  INSERT INTO public.job_stage_instances (
    job_id,
    job_table_name,
    production_stage_id,
    stage_order,
    status,
    notes
  )
  SELECT 
    (p_job_reorders->0->>'job_id')::uuid,
    'production_jobs',
    p_master_queue_stage_id,
    999,
    'completed',
    'Master queue reordered by manager'
  WHERE jsonb_array_length(p_job_reorders) > 0;

  RETURN true;
END;
$function$