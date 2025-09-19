-- Fix job D426216: Revert wrongly auto-activated HP12000 stage to pending status
-- This addresses the immediate issue while the frontend fixes prevent future auto-activation

UPDATE job_stage_instances 
SET 
  status = 'pending',
  started_at = NULL,
  started_by = NULL,
  updated_at = now()
WHERE job_id IN (
  SELECT pj.id 
  FROM production_jobs pj 
  WHERE pj.wo_no = 'D426216'
)
  AND production_stage_id IN (
    SELECT ps.id 
    FROM production_stages ps 
    WHERE ps.name ILIKE '%HP12000%'
  )
  AND status = 'active';

-- Log the correction
DO $$
DECLARE
    affected_count INTEGER;
BEGIN
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RAISE NOTICE 'Reverted % HP12000 stages for job D426216 from active to pending status', affected_count;
END $$;