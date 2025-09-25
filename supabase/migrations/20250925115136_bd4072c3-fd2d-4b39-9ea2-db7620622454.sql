-- Fix job D426275's Box Gluing stage duration immediately
-- Update the stage with calculated duration based on production stage defaults

UPDATE job_stage_instances 
SET 
  estimated_duration_minutes = (
    SELECT calculate_stage_duration(
      COALESCE(pj.qty, 1000), -- Use job quantity or default
      COALESCE(ps.running_speed_per_hour, 100), -- Use stage speed or default
      COALESCE(ps.make_ready_time_minutes, 30), -- Use stage make-ready or default
      COALESCE(ps.speed_unit, 'items_per_hour') -- Use stage speed unit or default
    )
    FROM production_jobs pj, production_stages ps
    WHERE pj.id = job_stage_instances.job_id 
      AND ps.id = job_stage_instances.production_stage_id
      AND job_stage_instances.id = '52ce4020-944b-4bf8-acb3-0b7969fbbb87'
  ),
  updated_at = now()
WHERE id = '52ce4020-944b-4bf8-acb3-0b7969fbbb87';

-- Verify the update worked
SELECT 
  jsi.id,
  pj.wo_no,
  ps.name as stage_name,
  jsi.estimated_duration_minutes,
  jsi.stage_specification_id
FROM job_stage_instances jsi
JOIN production_jobs pj ON jsi.job_id = pj.id
JOIN production_stages ps ON jsi.production_stage_id = ps.id
WHERE jsi.id = '52ce4020-944b-4bf8-acb3-0b7969fbbb87';