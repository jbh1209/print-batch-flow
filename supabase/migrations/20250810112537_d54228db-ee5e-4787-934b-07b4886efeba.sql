-- Enable required extensions (safe if already enabled)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Unschedule existing job if present, then (re)schedule every 2 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('auto-schedule-approved-every-2-min');
EXCEPTION WHEN others THEN
  -- ignore if it didn't exist
  NULL;
END$$;

select
  cron.schedule(
    'auto-schedule-approved-every-2-min',
    '*/2 * * * *',
    $$
    select net.http_post(
      url := 'https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/auto-schedule-approved',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXp1c2dxZXhtbGZjcWZqb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTQwNzAsImV4cCI6MjA2MDEzMDA3MH0.NA2wRme-L8Z15my7n8u-BCQtO4Nw2opfsX0KSLYcs-I"}'::jsonb,
      body := '{"source":"cron"}'::jsonb
    );
    $$
  );