-- Disable the full reschedule trigger on production_jobs table
-- This trigger causes unwanted full reschedules during working hours
-- We rely on the job_stage_instances trigger for append-only scheduling

-- Drop the trigger first
DROP TRIGGER IF EXISTS trg_schedule_on_approval ON production_jobs;

-- Drop the function with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS trigger_schedule_on_job_proof_approval() CASCADE;

-- Log the change
INSERT INTO batch_allocation_logs (job_id, action, details)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'disable_full_reschedule_trigger',
  'Disabled trg_schedule_on_approval trigger on production_jobs to prevent full reschedules during working hours. Using append-only scheduling via job_stage_instances trigger instead.'
);