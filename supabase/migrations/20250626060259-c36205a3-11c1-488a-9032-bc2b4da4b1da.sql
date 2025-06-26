
-- Add manual SLA fields to production_jobs table
ALTER TABLE production_jobs 
ADD COLUMN manual_due_date DATE,
ADD COLUMN manual_sla_days INTEGER;

-- Create function to reset auto-started custom workflow stages to pending
CREATE OR REPLACE FUNCTION public.reset_custom_workflow_stages_to_pending()
RETURNS TABLE(reset_job_id uuid, wo_no text, stages_reset integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  job_record RECORD;
  reset_count INTEGER;
BEGIN
  -- Find jobs with custom workflows that have auto-started stages
  FOR job_record IN
    SELECT DISTINCT 
      pj.id,
      pj.wo_no
    FROM public.production_jobs pj
    INNER JOIN public.job_stage_instances jsi ON pj.id = jsi.job_id
    WHERE pj.has_custom_workflow = true
      AND jsi.job_table_name = 'production_jobs'
      AND jsi.status = 'active'
      AND jsi.started_at IS NOT NULL
  LOOP
    -- Reset all active stages to pending for this custom workflow job
    UPDATE public.job_stage_instances
    SET 
      status = 'pending',
      started_at = NULL,
      started_by = NULL,
      updated_at = now()
    WHERE job_stage_instances.job_id = job_record.id
      AND job_stage_instances.job_table_name = 'production_jobs'
      AND job_stage_instances.status = 'active';
    
    GET DIAGNOSTICS reset_count = ROW_COUNT;
    
    -- Return the job info and count of stages reset
    RETURN QUERY SELECT 
      job_record.id,
      job_record.wo_no,
      reset_count;
  END LOOP;
END;
$function$;

-- Run the function to fix existing auto-started custom workflows
SELECT * FROM public.reset_custom_workflow_stages_to_pending();
