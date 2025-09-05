-- Temporarily disable the dependency enforcement trigger to test the scheduler
-- This will allow us to see what stages are actually being processed

ALTER TABLE stage_time_slots DISABLE TRIGGER trg_enforce_stage_dependencies;

-- Run a test to see what the scheduler is actually trying to create
SELECT simple_scheduler_wrapper('reschedule_all');

-- Check what got created
SELECT 
  sts.id,
  sts.stage_instance_id,
  sts.slot_start_time,
  sts.slot_end_time,
  ps.name as stage_name,
  jsi.stage_order,
  jsi.part_assignment
FROM stage_time_slots sts
JOIN job_stage_instances jsi ON jsi.id = sts.stage_instance_id
JOIN production_stages ps ON ps.id = jsi.production_stage_id
WHERE jsi.job_id = '8df6da79-e6e3-466e-96aa-bae186870c18'
ORDER BY jsi.stage_order, sts.slot_start_time;

-- Re-enable the trigger
ALTER TABLE stage_time_slots ENABLE TRIGGER trg_enforce_stage_dependencies;