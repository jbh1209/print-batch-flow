-- ============================================================
-- FIX: Restore cron_nightly_reschedule_with_carryforward function
-- ============================================================
-- This function was calling removed scheduler_reschedule_all_parallel_aware()
-- Restoring Oct 25th version that calls simple-scheduler edge function instead
-- ============================================================

-- Drop the broken current version
DROP FUNCTION IF EXISTS public.cron_nightly_reschedule_with_carryforward() CASCADE;

-- Recreate the working Oct 25th version
CREATE FUNCTION public.cron_nightly_reschedule_with_carryforward() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;

ALTER FUNCTION public.cron_nightly_reschedule_with_carryforward() OWNER TO postgres;

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- Run this to verify the function was restored correctly:
-- SELECT routine_name, routine_definition 
-- FROM information_schema.routines 
-- WHERE routine_name = 'cron_nightly_reschedule_with_carryforward';
