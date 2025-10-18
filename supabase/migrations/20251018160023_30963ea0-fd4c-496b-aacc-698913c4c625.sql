-- Create a secure secrets table for cron job authentication
CREATE TABLE IF NOT EXISTS public._app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS but restrict access via grants (only postgres/service role)
ALTER TABLE public._app_secrets ENABLE ROW LEVEL SECURITY;

-- Only superuser/service role can access
CREATE POLICY "Only service role can access secrets"
ON public._app_secrets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Insert the service role key
INSERT INTO public._app_secrets (key, value)
VALUES ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXp1c2dxZXhtbGZjcWZqb3BrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDU1NDA3MCwiZXhwIjoyMDYwMTMwMDcwfQ.K-NXJ8pNRIRD0NemG997_pV5GRUiS5tpJYoTTRYL3Hg')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Update cron function to read from secrets table
CREATE OR REPLACE FUNCTION public.cron_nightly_reschedule_with_carryforward()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  response_id bigint;
  service_key text;
BEGIN
  RAISE NOTICE '🌙 Nightly cron starting at %', now();
  
  -- Carry forward overdue jobs
  UPDATE production_jobs 
  SET status = 'In Production'
  WHERE status = 'Approved' 
    AND due_date < CURRENT_DATE;
  
  RAISE NOTICE '📞 Calling simple-scheduler edge function (nuclear reschedule)';
  
  -- Get service role key from secrets table
  SELECT value INTO service_key
  FROM public._app_secrets
  WHERE key = 'service_role_key';
  
  IF service_key IS NULL THEN
    RAISE WARNING '⚠️ Service role key not found in _app_secrets table';
    RETURN;
  END IF;
  
  -- Call the simple-scheduler edge function (same payload as UI "Reschedule All" button)
  SELECT net.http_post(
    url := 'https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/simple-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'commit', true,
      'proposed', false,
      'onlyIfUnset', false,
      'nuclear', true,
      'wipeAll', true
    )
  ) INTO response_id;
  
  RAISE NOTICE '✅ Edge function called, response_id: %', response_id;
END;
$function$;