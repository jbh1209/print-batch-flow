-- Fix scheduler by dropping existing functions and rebuilding with proper working day logic
-- This fixes the broken scheduler while keeping FIFO ordering

-- Drop existing functions that may have parameter conflicts
DROP FUNCTION IF EXISTS public.next_working_start(timestamptz);
DROP FUNCTION IF EXISTS public.place_duration_in_working_time(timestamptz, integer, uuid);

-- Create helper function to find next working start time
CREATE OR REPLACE FUNCTION public.next_working_start(p_from_time timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  target_date date;
  working_start timestamptz;
BEGIN
  target_date := p_from_time::date;
  
  -- Find next working day
  WHILE true LOOP
    -- Check if it's a working day (not weekend, not holiday)
    IF EXTRACT(dow FROM target_date) BETWEEN 1 AND 5 
       AND NOT EXISTS (
         SELECT 1 FROM public_holidays 
         WHERE date = target_date AND COALESCE(is_active, true) = true
       ) THEN
      
      -- Get shift start time for this day
      SELECT (target_date + shift_start_time) INTO working_start
      FROM shift_schedules
      WHERE day_of_week = EXTRACT(dow FROM target_date)::int
        AND COALESCE(is_active, true) = true
        AND is_working_day = true
      LIMIT 1;
      
      IF working_start IS NOT NULL AND working_start >= p_from_time THEN
        RETURN working_start;
      END IF;
    END IF;
    
    target_date := target_date + interval '1 day';
  END LOOP;
END;
$$;

-- Create function to place duration within working windows
CREATE OR REPLACE FUNCTION public.place_duration_in_working_time(
  p_earliest_start timestamptz,
  p_duration_minutes integer,
  p_stage_id uuid DEFAULT NULL
)
RETURNS TABLE(
  start_time timestamptz,
  end_time timestamptz,
  spans_multiple_days boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  current_time timestamptz := p_earliest_start;
  remaining_minutes integer := p_duration_minutes;
  final_start timestamptz := p_earliest_start;
  final_end timestamptz;
  current_date date;
  shift_start time;
  shift_end time;
  lunch_start time;
  lunch_duration_mins integer;
  day_start timestamptz;
  day_end timestamptz;
  lunch_start_ts timestamptz;
  lunch_end_ts timestamptz;
  available_before_lunch integer;
  available_after_lunch integer;
  minutes_to_use integer;
BEGIN
  -- If duration is 0 or negative, return immediate time
  IF remaining_minutes <= 0 THEN
    RETURN QUERY SELECT p_earliest_start, p_earliest_start, false;
    RETURN;
  END IF;

  WHILE remaining_minutes > 0 LOOP
    current_date := current_time::date;
    
    -- Get shift details for current date
    SELECT 
      shift_start_time, 
      shift_end_time, 
      lunch_break_start_time, 
      lunch_break_duration_minutes
    INTO shift_start, shift_end, lunch_start, lunch_duration_mins
    FROM shift_schedules
    WHERE day_of_week = EXTRACT(dow FROM current_date)::int
      AND COALESCE(is_active, true) = true
      AND is_working_day = true;
    
    -- If not a working day, move to next working day
    IF shift_start IS NULL OR EXISTS (
      SELECT 1 FROM public_holidays 
      WHERE date = current_date AND COALESCE(is_active, true) = true
    ) THEN
      current_time := public.next_working_start(current_date + interval '1 day');
      CONTINUE;
    END IF;
    
    -- Calculate day boundaries
    day_start := current_date + shift_start;
    day_end := current_date + shift_end;
    lunch_start_ts := current_date + lunch_start;
    lunch_end_ts := lunch_start_ts + make_interval(mins => lunch_duration_mins);
    
    -- Ensure current_time is within working hours
    IF current_time < day_start THEN
      current_time := day_start;
    END IF;
    
    -- If past working hours, move to next day
    IF current_time >= day_end THEN
      current_time := public.next_working_start(current_date + interval '1 day');
      CONTINUE;
    END IF;
    
    -- Calculate available time before lunch
    IF current_time < lunch_start_ts THEN
      available_before_lunch := EXTRACT(epoch FROM (lunch_start_ts - current_time))::integer / 60;
    ELSE
      available_before_lunch := 0;
    END IF;
    
    -- Calculate available time after lunch
    IF current_time < lunch_end_ts THEN
      available_after_lunch := EXTRACT(epoch FROM (day_end - lunch_end_ts))::integer / 60;
    ELSE
      available_after_lunch := EXTRACT(epoch FROM (day_end - GREATEST(current_time, lunch_end_ts)))::integer / 60;
    END IF;
    
    -- Determine how much time to use from this day
    IF current_time < lunch_start_ts AND remaining_minutes <= available_before_lunch THEN
      -- Fits entirely before lunch
      final_end := current_time + make_interval(mins => remaining_minutes);
      RETURN QUERY SELECT final_start, final_end, (final_start::date != final_end::date);
      RETURN;
    ELSIF current_time < lunch_start_ts THEN
      -- Use time before lunch, then continue after lunch
      minutes_to_use := available_before_lunch;
      remaining_minutes := remaining_minutes - minutes_to_use;
      current_time := lunch_end_ts;
    ELSIF current_time >= lunch_end_ts AND remaining_minutes <= available_after_lunch THEN
      -- Fits entirely after lunch today
      final_end := current_time + make_interval(mins => remaining_minutes);
      RETURN QUERY SELECT final_start, final_end, (final_start::date != final_end::date);
      RETURN;
    ELSIF current_time >= lunch_end_ts THEN
      -- Use remaining time today, continue tomorrow
      minutes_to_use := available_after_lunch;
      remaining_minutes := remaining_minutes - minutes_to_use;
      current_time := public.next_working_start(current_date + interval '1 day');
    ELSE
      -- Between lunch start and end, skip to after lunch
      current_time := lunch_end_ts;
    END IF;
  END LOOP;
  
  -- Should not reach here, but safety fallback
  RETURN QUERY SELECT final_start, current_time, (final_start::date != current_time::date);
END;
$$;

-- Rebuild the scheduler with proper working day logic + FIFO ordering
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware()
RETURNS TABLE(updated_jsi integer, wrote_slots integer, violations text[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_record RECORD;
  job_record RECORD;
  base_time timestamptz;
  slot_start timestamptz;
  slot_end timestamptz;
  total_updated integer := 0;
  total_slots integer := 0;
  violation_list text[] := '{}';
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 42);
  
  -- Start scheduling from next working day at 8 AM
  base_time := public.next_working_start(date_trunc('day', now()) + interval '1 day');
  
  RAISE NOTICE 'Starting FIFO scheduler with working day logic from: %', base_time;
  
  -- Clear all existing schedules for pending stages
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE status = 'pending';
  
  -- Clear all existing time slots
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  
  -- Create stage availability tracker with working time logic
  CREATE TEMP TABLE IF NOT EXISTS stage_availability (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
  
  -- Initialize stage availability for all active stages
  INSERT INTO stage_availability (stage_id, next_available_time)
  SELECT id, base_time
  FROM production_stages 
  WHERE is_active = true
  ON CONFLICT (stage_id) DO UPDATE SET next_available_time = EXCLUDED.next_available_time;
  
  -- Process jobs in FIFO order: proof_approved_at first, then created_at as fallback
  FOR job_record IN
    SELECT DISTINCT 
      jsi.job_id,
      pj.wo_no,
      COALESCE(pj.proof_approved_at, pj.created_at) as priority_timestamp
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status = 'pending'
    ORDER BY priority_timestamp ASC NULLS LAST  -- FIFO ordering
  LOOP
    RAISE NOTICE 'Processing job % (priority: %)', job_record.wo_no, job_record.priority_timestamp;
    
    -- Process stages for this job in stage_order
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.stage_order,
        COALESCE(jsi.estimated_duration_minutes, 60) as duration_minutes,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON jsi.production_stage_id = ps.id
      WHERE jsi.job_id = job_record.job_id
        AND jsi.job_table_name = 'production_jobs'  
        AND jsi.status = 'pending'
      ORDER BY jsi.stage_order
    LOOP
      -- Get next available time for this stage
      SELECT next_available_time INTO slot_start
      FROM stage_availability 
      WHERE stage_id = stage_record.production_stage_id;
      
      -- Place duration within working time constraints
      SELECT start_time, end_time INTO slot_start, slot_end
      FROM public.place_duration_in_working_time(
        slot_start, 
        stage_record.duration_minutes,
        stage_record.production_stage_id
      );
      
      -- Update job stage instance with schedule
      UPDATE job_stage_instances 
      SET 
        scheduled_start_at = slot_start,
        scheduled_end_at = slot_end,
        scheduled_minutes = stage_record.duration_minutes,
        schedule_status = 'scheduled',
        updated_at = now()
      WHERE id = stage_record.id;
      
      -- Create time slot
      INSERT INTO stage_time_slots (
        production_stage_id,
        job_id,
        stage_instance_id,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        job_table_name
      ) VALUES (
        stage_record.production_stage_id,
        job_record.job_id,
        stage_record.id,
        slot_start,
        slot_end,
        stage_record.duration_minutes,
        'production_jobs'
      );
      
      -- Update stage availability to end of this job + some buffer
      UPDATE stage_availability 
      SET next_available_time = slot_end
      WHERE stage_id = stage_record.production_stage_id;
      
      total_updated := total_updated + 1;
      total_slots := total_slots + 1;
      
      RAISE NOTICE 'Scheduled % stage % for job % from % to % (duration: %min)', 
        stage_record.stage_name, stage_record.production_stage_id, job_record.wo_no, 
        slot_start, slot_end, stage_record.duration_minutes;
    END LOOP;
  END LOOP;
  
  DROP TABLE IF EXISTS stage_availability;
  
  RAISE NOTICE 'FIFO scheduler completed: % stages updated, % time slots created', total_updated, total_slots;
  
  RETURN QUERY SELECT total_updated, total_slots, violation_list;
END;
$$;