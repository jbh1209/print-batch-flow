
-- Fix existing job stage instances that are incorrectly marked as active
-- Only the first stage in each job should be active, rest should be pending
UPDATE public.job_stage_instances 
SET status = 'pending'
WHERE status = 'active' 
  AND id NOT IN (
    -- Keep only the first stage of each job as active
    SELECT DISTINCT ON (job_id, job_table_name) id
    FROM public.job_stage_instances
    WHERE status = 'active'
    ORDER BY job_id, job_table_name, stage_order ASC
  );
