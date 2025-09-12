-- Time-aware carry-forward system for active overdue jobs
-- Excludes DTP/PROOF stages and multi-shift jobs

-- 1. Next shift start resolver (time-aware)
CREATE OR REPLACE FUNCTION next_shift_start_from_now()
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  current_date_local date;
  current_time_local time;
  shift_info record;
  check_date date;
  days_ahead integer := 0;
BEGIN
  -- Get current date and time in factory timezone
  current_date_local := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  current_time_local := (now() AT TIME ZONE 'Africa/Johannesburg')::time;
  
  -- Get today's shift window
  SELECT win_start, win_end INTO shift_info
  FROM shift_window(current_date_local);
  
  -- If we have a shift today and current time is before shift start
  IF shift_info.win_start IS NOT NULL AND current_time_local < (shift_info.win_start AT TIME ZONE 'UTC')::time THEN
    RETURN shift_info.win_start;
  END IF;
  
  -- Otherwise, find next working day's shift start
  check_date := current_date_local + interval '1 day';
  
  -- Loop to find next working day (max 14 days ahead for safety)
  WHILE days_ahead < 14 LOOP
    -- Check if this date has a shift and is not a holiday
    SELECT win_start INTO shift_info.win_start
    FROM shift_window(check_date)
    WHERE win_start IS NOT NULL;
    
    -- Also check it's not a public holiday
    IF shift_info.win_start IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public_holidays 
      WHERE date = check_date AND COALESCE(is_active, true) = true
    ) THEN
      RETURN shift_info.win_start;
    END IF;
    
    check_date := check_date + interval '1 day';
    days_ahead := days_ahead + 1;
  END LOOP;
  
  -- Fallback: return tomorrow at 8 AM UTC
  RETURN (current_date_local + interval '1 day + 8 hours') AT TIME ZONE 'Africa/Johannesburg';
END;
$function$;

-- 2. Carry-forward function for overdue active jobs
CREATE OR REPLACE FUNCTION carry_forward_overdue_active_jobs()
RETURNS TABLE(carried_forward_count integer, job_details text[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  job_record RECORD;
  total_carried integer := 0;
  job_list text[] := '{}';
  shift_end_time timestamptz;
BEGIN
  RAISE NOTICE 'Starting carry-forward of overdue active jobs (single-shift only)...';
  
  -- Find and process overdue active jobs (excluding DTP/PROOF, single-shift only)
  FOR job_record IN
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.scheduled_start_at,
      jsi.scheduled_end_at,
      jsi.started_at,
      jsi.started_by,
      ps.name as stage_name,
      pj.wo_no,
      sw.win_end as shift_end_for_day,
      EXTRACT(EPOCH FROM (now() - jsi.scheduled_end_at)) / 3600 as hours_overdue
    FROM job_stage_instances jsi
    JOIN production_stages ps ON jsi.production_stage_id = ps.id
    JOIN production_jobs pj ON jsi.job_id = pj.id
    LEFT JOIN shift_window(jsi.scheduled_start_at::date) sw ON true
    WHERE jsi.status = 'active'
      AND jsi.scheduled_end_at IS NOT NULL
      AND jsi.scheduled_end_at < NOW()
      AND jsi.job_table_name = 'production_jobs'
      AND ps.name NOT ILIKE '%dtp%'
      AND ps.name NOT ILIKE '%proof%'
      -- Only single-shift jobs: scheduled end must be within the same day's shift window
      AND (sw.win_end IS NULL OR jsi.scheduled_end_at <= sw.win_end)
    ORDER BY jsi.scheduled_end_at ASC -- Process most overdue first
  LOOP
    -- Reset the overdue active job to pending with priority
    UPDATE job_stage_instances
    SET 
      status = 'pending',
      started_at = NULL,
      started_by = NULL,
      job_order_in_stage = 0, -- Priority position
      notes = COALESCE(notes || E'\n', '') || 
              'CARRIED_FORWARD: Was active but overdue by ' || 
              ROUND(job_record.hours_overdue::numeric, 1) || ' hours on ' || 
              now()::date || ' at 3 AM reschedule',
      updated_at = now()
    WHERE id = job_record.stage_instance_id;
    
    -- Clear existing time slots for this stage
    DELETE FROM stage_time_slots 
    WHERE stage_instance_id = job_record.stage_instance_id;
    
    total_carried := total_carried + 1;
    job_list := job_list || (job_record.wo_no || ' (' || job_record.stage_name || ')');
    
    RAISE NOTICE 'Carried forward: % - % (% hours overdue)', 
      job_record.wo_no, job_record.stage_name, ROUND(job_record.hours_overdue::numeric, 1);
  END LOOP;
  
  RAISE NOTICE 'Carry-forward complete: % jobs processed', total_carried;
  
  RETURN QUERY SELECT total_carried, job_list;
END;
$function$;

-- 3. Enhanced cron function with carry-forward and time-aware scheduling
CREATE OR REPLACE FUNCTION cron_nightly_reschedule_with_carryforward()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  carry_result RECORD;
  base_start_time timestamptz;
  scheduler_result jsonb;
BEGIN
  -- Get time-aware base start time
  base_start_time := next_shift_start_from_now();
  
  RAISE NOTICE 'Starting 3 AM reschedule with carry-forward. Base start time: %', base_start_time;
  
  -- Step 1: Carry forward overdue active jobs
  SELECT * INTO carry_result FROM carry_forward_overdue_active_jobs();
  
  RAISE NOTICE 'Carry-forward result: % jobs carried forward', carry_result.carried_forward_count;
  
  -- Step 2: Run the proven scheduler with time-aware start time
  SELECT scheduler_reschedule_all_parallel_aware(base_start_time) INTO scheduler_result;
  
  RAISE NOTICE 'Scheduler completed. Wrote % slots, updated % job stage instances', 
    scheduler_result->>'wrote_slots', scheduler_result->>'updated_jsi';
    
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in 3 AM reschedule: %', SQLERRM;
  RAISE;
END;
$function$;

-- 4. Schedule the enhanced cron job
-- Remove existing cron job if it exists
SELECT cron.unschedule('nightly-reschedule') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'nightly-reschedule'
);

-- Create new enhanced 3 AM cron job with carry-forward
SELECT cron.schedule(
  'nightly-reschedule',
  '0 3 * * *', -- 3 AM every day
  $$
  SELECT cron_nightly_reschedule_with_carryforward();
  $$
);