-- Setup cron job for nightly reconciliation
-- This runs every night at 2:00 AM to reconcile incomplete jobs

SELECT cron.schedule(
  'nightly-reconciliation',
  '0 2 * * *', -- 2:00 AM every day
  $$
  SELECT
    net.http_post(
      url := 'https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/nightly-reconciliation',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXp1c2dxZXhtbGZjcWZqb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTQwNzAsImV4cCI6MjA2MDEzMDA3MH0.NA2wRme-L8Z15my7n8u-BCQtO4Nw2opfsX0KSLYcs-I"}'::jsonb,
      body := '{"trigger": "cron_job"}'::jsonb
    ) as request_id;
  $$
);