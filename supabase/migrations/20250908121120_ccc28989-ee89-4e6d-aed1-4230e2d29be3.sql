-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Task 1: Auto-update work order due dates after scheduling
-- Function to calculate +1 working day from a given timestamp
CREATE OR REPLACE FUNCTION public.add_working_days_to_timestamp(p_start_timestamp timestamptz, p_days_to_add integer)
RETURNS timestamptz AS $$
DECLARE
  current_date date;
  days_added integer := 0;
  final_timestamp timestamptz;
BEGIN
  -- Start from the date of the given timestamp
  current_date := p_start_timestamp::date;
  
  WHILE days_added < p_days_to_add LOOP
    current_date := current_date + interval '1 day';
    
    -- Skip weekends and check if it's a working day
    IF EXTRACT(DOW FROM current_date) NOT IN (0, 6) 
       AND NOT EXISTS (
         SELECT 1 FROM public.public_holidays 
         WHERE date = current_date AND COALESCE(is_active, true) = true
       ) THEN
      days_added := days_added + 1;
    END IF;
  END LOOP;
  
  -- Keep the same time as the original timestamp but on the new date
  final_timestamp := current_date + (p_start_timestamp::time);
  
  RETURN final_timestamp;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update job due dates after scheduling
CREATE OR REPLACE FUNCTION public.update_job_due_dates_after_scheduling()
RETURNS void AS $$
DECLARE
  job_record RECORD;
  latest_scheduled_end timestamptz;
  new_completion_date date;
BEGIN
  -- Find jobs that have been scheduled but don't have internal_completion_date set
  FOR job_record IN
    SELECT DISTINCT pj.id, pj.wo_no
    FROM public.production_jobs pj
    WHERE pj.internal_completion_date IS NULL
      AND EXISTS (
        SELECT 1 FROM public.job_stage_instances jsi
        WHERE jsi.job_id = pj.id 
          AND jsi.job_table_name = 'production_jobs'
          AND jsi.scheduled_end_at IS NOT NULL
      )
  LOOP
    -- Find the latest scheduled_end_at for this job
    SELECT MAX(jsi.scheduled_end_at) INTO latest_scheduled_end
    FROM public.job_stage_instances jsi
    WHERE jsi.job_id = job_record.id 
      AND jsi.job_table_name = 'production_jobs'
      AND jsi.scheduled_end_at IS NOT NULL;
    
    IF latest_scheduled_end IS NOT NULL THEN
      -- Add +1 working day buffer
      new_completion_date := public.add_working_days_to_timestamp(latest_scheduled_end, 1)::date;
      
      -- Update the production job with the new completion date
      UPDATE public.production_jobs
      SET 
        internal_completion_date = new_completion_date,
        due_date = new_completion_date, -- Update the main due_date too
        updated_at = now()
      WHERE id = job_record.id;
      
      RAISE NOTICE 'Updated job % due date to % (latest stage ends at %)', 
        job_record.wo_no, new_completion_date, latest_scheduled_end;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function that fires when scheduled_end_at changes
CREATE OR REPLACE FUNCTION public.trigger_update_job_due_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if scheduled_end_at was just set or changed
  IF (OLD.scheduled_end_at IS NULL AND NEW.scheduled_end_at IS NOT NULL) 
     OR (OLD.scheduled_end_at IS NOT NULL AND NEW.scheduled_end_at IS NOT NULL AND OLD.scheduled_end_at != NEW.scheduled_end_at) THEN
    
    -- Call the function to update due dates (async to avoid blocking)
    PERFORM public.update_job_due_dates_after_scheduling();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trg_update_job_due_dates_after_scheduling
  AFTER UPDATE OF scheduled_end_at ON public.job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_job_due_dates();

-- Task 2: Create nightly cron job for reschedule all
-- Function to handle nightly reschedule with proper logging
CREATE OR REPLACE FUNCTION public.cron_nightly_reschedule()
RETURNS void AS $$
DECLARE
  next_8am_timestamp text;
  response_id bigint;
BEGIN
  -- Calculate next 8 AM (tomorrow if it's past 8 AM today)
  next_8am_timestamp := CASE 
    WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'Africa/Johannesburg') >= 8 
    THEN (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '8 hours')::text
    ELSE (CURRENT_DATE + INTERVAL '8 hours')::text
  END;
  
  -- Log the start of nightly reschedule
  INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, 
    'CRON', 
    'nightly_reschedule_start', 
    'Starting nightly reschedule for next shift at ' || next_8am_timestamp
  );
  
  -- Call the scheduler via HTTP (using service role for internal calls)
  SELECT net.http_post(
    url := 'https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/simple-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXp1c2dxZXhtbGZjcWZqb3BrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDU1NDA3MCwiZXhwIjoyMDYwMTMwMDcwfQ.wcFWqG5VklHgBBVy4Ot0nWCf-qfSP2LmUt2MfO8ajE4"}'::jsonb,
    body := jsonb_build_object(
      'commit', true,
      'onlyIfUnset', false,  -- Reschedule everything
      'startFrom', next_8am_timestamp
    )
  ) INTO response_id;
  
  -- Log completion
  INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, 
    'CRON', 
    'nightly_reschedule_complete', 
    'Nightly reschedule completed, response_id: ' || COALESCE(response_id::text, 'null')
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, 
    'CRON', 
    'nightly_reschedule_error', 
    'Nightly reschedule failed: ' || SQLERRM
  );
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cron job to run every night at 2 AM
SELECT cron.schedule(
  'nightly-reschedule-all',
  '0 2 * * *', -- 2 AM every day
  $$SELECT public.cron_nightly_reschedule();$$
);

-- Run initial due date update for any existing scheduled jobs
SELECT public.update_job_due_dates_after_scheduling();