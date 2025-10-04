-- Create nightly cron job to use correct parallel-aware scheduler function
-- This runs at 3 AM daily and includes gap-filling optimization

SELECT cron.schedule(
  'nightly-reschedule-consolidated',
  '0 3 * * *',
  $$
  SELECT scheduler_reschedule_all_parallel_aware();
  $$
);