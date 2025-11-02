-- Unschedule all PROOF and DTP stages
-- These stages are informational only and should never be scheduled

-- Clear schedule data from PROOF and DTP job_stage_instances
UPDATE job_stage_instances jsi
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = NULL,
  schedule_status = 'unscheduled'
FROM production_stages ps
WHERE jsi.production_stage_id = ps.id
  AND (ps.name ILIKE '%PROOF%' OR ps.name ILIKE '%DTP%');

-- Delete any stage_time_slots for PROOF/DTP stages
DELETE FROM stage_time_slots sts
USING job_stage_instances jsi
JOIN production_stages ps ON ps.id = jsi.production_stage_id
WHERE sts.stage_instance_id = jsi.id
  AND (ps.name ILIKE '%PROOF%' OR ps.name ILIKE '%DTP%');