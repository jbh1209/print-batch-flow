-- Fix queue management logic to support parallel processing within daily capacity
-- Replace the broken queue logic that forces sequential scheduling

-- Drop the old broken functions
DROP FUNCTION IF EXISTS public.get_stage_queue_end_time(uuid, date);
DROP FUNCTION IF EXISTS public.update_stage_queue_end_time(uuid, timestamp with time zone, date);
DROP FUNCTION IF EXISTS public.sync_stage_queue_times();

-- Create improved queue management that respects daily capacity
CREATE OR REPLACE FUNCTION public.get_stage_available_time(
  p_stage_id uuid, 
  p_duration_minutes integer,
  p_earliest_start timestamp with time zone DEFAULT NOW()
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_capacity_hours integer;
  current_date date;
  current_start_time timestamp with time zone;
  daily_used_minutes integer;
  daily_capacity_minutes integer;
  day_start_time timestamp with time zone;
  day_end_time timestamp with time zone;
BEGIN
  -- Get stage daily capacity (default to 8 hours)
  SELECT COALESCE(daily_capacity_hours, 8) INTO stage_capacity_hours
  FROM public.stage_capacity_profiles
  WHERE production_stage_id = p_stage_id;
  
  daily_capacity_minutes := stage_capacity_hours * 60;
  
  -- Start checking from the earliest allowed start time
  current_start_time := p_earliest_start;
  
  -- Ensure we start on a working day at working hours
  -- If before 8 AM, move to 8 AM same day
  -- If after 5:30 PM, move to 8 AM next working day
  -- If weekend, move to 8 AM next Monday
  LOOP
    current_date := current_start_time::date;
    
    -- Skip weekends
    IF EXTRACT(dow FROM current_date) IN (0, 6) THEN
      current_start_time := (current_date + interval '1 day')::timestamp + interval '8 hours';
      CONTINUE;
    END IF;
    
    day_start_time := current_date::timestamp + interval '8 hours';
    day_end_time := current_date::timestamp + interval '17 hours 30 minutes';
    
    -- If current time is before 8 AM, start at 8 AM
    IF current_start_time < day_start_time THEN
      current_start_time := day_start_time;
    END IF;
    
    -- If current time is after 5:30 PM, move to next day
    IF current_start_time >= day_end_time THEN
      current_start_time := (current_date + interval '1 day')::timestamp + interval '8 hours';
      CONTINUE;
    END IF;
    
    -- Calculate already used capacity for this day
    SELECT COALESCE(SUM(
      CASE 
        WHEN scheduled_end_at IS NOT NULL AND scheduled_start_at IS NOT NULL 
        THEN EXTRACT(epoch FROM (scheduled_end_at - scheduled_start_at)) / 60
        ELSE 0 
      END
    ), 0)::integer INTO daily_used_minutes
    FROM public.job_stage_instances
    WHERE production_stage_id = p_stage_id
      AND scheduled_start_at::date = current_date
      AND status IN ('active', 'pending');
    
    -- Check if this job fits in remaining capacity
    IF (daily_used_minutes + p_duration_minutes) <= daily_capacity_minutes THEN
      -- Job fits! Find the earliest available slot within working hours
      -- For simplicity, we'll just use the current start time
      -- (More complex logic could find exact gaps, but this fixes the main issue)
      
      -- Ensure the job doesn't extend past working hours
      IF (current_start_time + interval '1 minute' * p_duration_minutes) <= day_end_time THEN
        RETURN current_start_time;
      END IF;
    END IF;
    
    -- Job doesn't fit today, try next working day
    current_start_time := (current_date + interval '1 day')::timestamp + interval '8 hours';
  END LOOP;
  
  -- Should never reach here, but just in case
  RETURN current_start_time;
END;
$$;

-- Update the schedule-on-approval logic to use the new function
-- This replaces the broken queue accumulation logic