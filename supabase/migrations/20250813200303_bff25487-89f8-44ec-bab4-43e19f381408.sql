-- **PHASE 2: DISABLE BROKEN SEQUENTIAL QUEUE FUNCTION**
-- Replace get_stage_queue_end_time() with capacity-aware version

-- First, drop the existing function that causes "10 days later" bug
DROP FUNCTION IF EXISTS public.get_stage_queue_end_time(uuid, date);

-- Create new capacity-aware function that finds next available slot within daily capacity
CREATE OR REPLACE FUNCTION public.get_next_capacity_slot(
  p_stage_id uuid, 
  p_duration_minutes integer,
  p_earliest_date date DEFAULT CURRENT_DATE
) RETURNS TABLE(
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  date_scheduled date
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_capacity_hours integer := 8; -- Default 8 hours daily capacity
  current_date date;
  used_minutes integer;
  available_minutes integer;
  slot_start_time timestamp with time zone;
  slot_end_time timestamp with time zone;
BEGIN
  -- Get stage capacity from profile
  SELECT daily_capacity_hours INTO stage_capacity_hours
  FROM public.stage_capacity_profiles 
  WHERE production_stage_id = p_stage_id;
  
  -- Default to 8 hours if no profile found
  stage_capacity_hours := COALESCE(stage_capacity_hours, 8);
  
  -- Start checking from earliest date
  current_date := p_earliest_date;
  
  -- Loop through working days to find available capacity
  FOR i IN 0..90 LOOP -- Max 90 day search window
    -- Skip weekends
    IF EXTRACT(dow FROM current_date) NOT IN (0, 6) THEN
      
      -- Calculate used capacity for this stage on this date
      SELECT COALESCE(SUM(
        CASE 
          WHEN auto_scheduled_duration_minutes IS NOT NULL THEN auto_scheduled_duration_minutes
          ELSE scheduled_minutes
        END
      ), 0) INTO used_minutes
      FROM public.job_stage_instances jsi
      WHERE jsi.production_stage_id = p_stage_id
        AND jsi.status IN ('pending', 'active')
        AND (
          (jsi.auto_scheduled_start_at IS NOT NULL AND 
           DATE(jsi.auto_scheduled_start_at AT TIME ZONE 'Africa/Johannesburg') = current_date) OR
          (jsi.scheduled_start_at IS NOT NULL AND 
           DATE(jsi.scheduled_start_at AT TIME ZONE 'Africa/Johannesburg') = current_date)
        );
      
      -- Calculate available capacity
      available_minutes := (stage_capacity_hours * 60) - used_minutes;
      
      -- Check if this date has enough capacity
      IF available_minutes >= p_duration_minutes THEN
        -- Found a slot! Calculate start time (8 AM SAST + used time)
        slot_start_time := (current_date + INTERVAL '8 hours') + (used_minutes || ' minutes')::INTERVAL;
        slot_end_time := slot_start_time + (p_duration_minutes || ' minutes')::INTERVAL;
        
        -- Ensure slot doesn't exceed working hours (8 AM - 5:30 PM = 9.5 hours)
        IF EXTRACT(hour FROM slot_end_time) <= 17 OR 
           (EXTRACT(hour FROM slot_end_time) = 17 AND EXTRACT(minute FROM slot_end_time) <= 30) THEN
          
          RETURN QUERY SELECT slot_start_time, slot_end_time, current_date;
          RETURN;
        END IF;
      END IF;
    END IF;
    
    -- Move to next day
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
  
  -- No capacity found in 90 days - return null
  RETURN;
END;
$$;