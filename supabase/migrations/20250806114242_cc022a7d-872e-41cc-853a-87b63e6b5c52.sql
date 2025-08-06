-- Backfill historical data for proof completion
-- Update all jobs that have completed PROOF stages to set proof_approved_at and production_ready

UPDATE public.production_jobs 
SET 
  proof_approved_at = COALESCE(
    (SELECT jsi.completed_at 
     FROM public.job_stage_instances jsi 
     JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
     WHERE jsi.job_id = production_jobs.id 
       AND jsi.job_table_name = 'production_jobs'
       AND ps.name ILIKE '%proof%' 
       AND jsi.status = 'completed'
     ORDER BY jsi.completed_at DESC 
     LIMIT 1),
    now() - INTERVAL '1 day' -- Default to yesterday for jobs without proof completion timestamp
  ),
  production_ready = true,
  last_queue_recalc_at = now(),
  updated_at = now()
WHERE id IN (
  SELECT DISTINCT pj.id
  FROM public.production_jobs pj
  JOIN public.job_stage_instances jsi ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE ps.name ILIKE '%proof%' 
    AND jsi.status = 'completed'
    AND pj.proof_approved_at IS NULL
);