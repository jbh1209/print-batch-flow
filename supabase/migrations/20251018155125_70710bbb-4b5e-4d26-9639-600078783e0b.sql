-- Update cron function to call simple-scheduler edge function (same as UI "Reschedule All" button)
-- This ensures nuclear delete + full reschedule happens correctly

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
  
  -- Get service role key from settings (must be set via: ALTER DATABASE postgres SET app.settings.service_role_key = 'your-key')
  BEGIN
    service_key := current_setting('app.settings.service_role_key', false);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Service role key not configured. Run: ALTER DATABASE postgres SET app.settings.service_role_key = ''your-key''';
    RETURN;
  END;
  
  -- Call the simple-scheduler edge function (same payload as UI "Reschedule All" button)
  -- This performs nuclear delete (wipeAll) + full reschedule from next working day
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