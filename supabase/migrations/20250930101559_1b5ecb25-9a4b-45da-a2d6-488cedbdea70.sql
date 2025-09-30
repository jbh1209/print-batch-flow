-- Remove the conflicting old scheduler cron job
-- This job was calling an outdated scheduler function and conflicts with the working 3 AM job

SELECT cron.unschedule('nightly-reschedule-all');

-- Log the cleanup
INSERT INTO batch_allocation_logs (job_id, action, details)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'remove_conflicting_cron_job',
  'Removed nightly-reschedule-all (2:00 AM) cron job. Keeping nightly-reschedule (3:00 AM) which correctly calls cron_nightly_reschedule_with_carryforward() to carry forward overdue jobs and run parallel-aware scheduler.'
);