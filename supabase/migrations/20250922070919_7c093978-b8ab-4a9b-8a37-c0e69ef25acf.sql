-- Remove existing conflicting nightly reschedule cron jobs
SELECT cron.unschedule('nightly-reschedule-all');
SELECT cron.unschedule('nightly-reschedule');

-- Create single consolidated nightly reschedule job at 3 AM using latest scheduler
SELECT cron.schedule(
  'nightly-reschedule-consolidated',
  '0 3 * * *', -- 3 AM daily
  $$
  SELECT scheduler_reschedule_all_parallel_aware();
  $$
);