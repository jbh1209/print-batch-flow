-- Fix nightly cron job to use the correct scheduler function
-- Remove the existing cron job
SELECT cron.unschedule('nightly-reschedule-consolidated');

-- Create new consolidated nightly reschedule job at 3 AM using the FIXED V2 scheduler
SELECT cron.schedule(
  'nightly-reschedule-consolidated-v2',
  '0 3 * * *', -- 3 AM daily
  $$
  SELECT scheduler_reschedule_all_sequential_fixed_v2();
  $$
);