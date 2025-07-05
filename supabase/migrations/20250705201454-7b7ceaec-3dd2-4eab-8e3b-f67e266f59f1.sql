-- Manually close stuck batch master job BATCH-DXB-BC-00011
UPDATE public.production_jobs 
SET 
  status = 'Completed',
  updated_at = now()
WHERE wo_no = 'BATCH-DXB-BC-00011' 
  AND is_batch_master = true;

-- Also complete any associated job stage instances
UPDATE public.job_stage_instances 
SET 
  status = 'completed',
  completed_at = now(),
  completed_by = (SELECT user_id FROM public.production_jobs WHERE wo_no = 'BATCH-DXB-BC-00011' LIMIT 1),
  updated_at = now()
WHERE job_id = (SELECT id FROM public.production_jobs WHERE wo_no = 'BATCH-DXB-BC-00011' LIMIT 1)
  AND job_table_name = 'production_jobs'
  AND status != 'completed';