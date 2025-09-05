-- Test the enhanced scheduler to see if dependency violations are fixed
-- Run the new sequential-enhanced scheduler

SELECT simple_scheduler_wrapper('reschedule_all');

-- Check what got created for our test job
SELECT 
  sts.id,
  sts.stage_instance_id,
  sts.slot_start_time,
  sts.slot_end_time,
  ps.name as stage_name,
  jsi.stage_order,
  jsi.part_assignment,
  EXTRACT(EPOCH FROM (sts.slot_end_time - sts.slot_start_time))/60 as duration_minutes
FROM stage_time_slots sts
JOIN job_stage_instances jsi ON jsi.id = sts.stage_instance_id
JOIN production_stages ps ON ps.id = jsi.production_stage_id
WHERE jsi.job_id = '8df6da79-e6e3-466e-96aa-bae186870c18'
ORDER BY jsi.stage_order, sts.slot_start_time;