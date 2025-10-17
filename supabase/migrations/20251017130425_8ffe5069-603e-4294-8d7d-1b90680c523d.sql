-- Fix the nightly-reschedule-consolidated cron job to use the proper carry-forward wrapper
-- This ensures on_hold/active/started stages get carried forward before rescheduling

SELECT cron.unschedule('nightly-reschedule-consolidated');

SELECT cron.schedule(
  'nightly-reschedule-consolidated',
  '0 3 * * *',
  $$
  SELECT cron_nightly_reschedule_with_carryforward();
  $$
);