-- Update database functions to use UTC timezone instead of Africa/Johannesburg

-- Update get_next_capacity_slot function to use UTC
CREATE OR REPLACE FUNCTION public.get_next_capacity_slot(p_stage_id uuid, p_duration_minutes integer, p_earliest_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(start_time timestamp with time zone, end_time timestamp with time zone, date_scheduled date)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  stage_capacity_hours integer := 8; -- Default 8 hours daily capacity
  check_date date;
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
  check_date := p_earliest_date;
  
  -- Loop through working days to find available capacity
  FOR i IN 0..90 LOOP -- Max 90 day search window
    -- Skip weekends
    IF EXTRACT(dow FROM check_date) NOT IN (0, 6) THEN
      
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
           DATE(jsi.auto_scheduled_start_at AT TIME ZONE 'UTC') = check_date) OR
          (jsi.scheduled_start_at IS NOT NULL AND 
           DATE(jsi.scheduled_start_at AT TIME ZONE 'UTC') = check_date)
        );
      
      -- Calculate available capacity
      available_minutes := (stage_capacity_hours * 60) - used_minutes;
      
      -- Check if this date has enough capacity
      IF available_minutes >= p_duration_minutes THEN
        -- Found a slot! Calculate start time (8 AM UTC + used time)
        slot_start_time := (check_date::timestamp + INTERVAL '8 hours') + (used_minutes || ' minutes')::INTERVAL;
        slot_end_time := slot_start_time + (p_duration_minutes || ' minutes')::INTERVAL;
        
        -- Ensure slot doesn't exceed working hours (8 AM - 5:30 PM = 9.5 hours)
        IF EXTRACT(hour FROM slot_end_time) <= 17 OR 
           (EXTRACT(hour FROM slot_end_time) = 17 AND EXTRACT(minute FROM slot_end_time) <= 30) THEN
          
          RETURN QUERY SELECT slot_start_time, slot_end_time, check_date;
          RETURN;
        END IF;
      END IF;
    END IF;
    
    -- Move to next day
    check_date := check_date + INTERVAL '1 day';
  END LOOP;
  
  -- No capacity found in 90 days - return null
  RETURN;
END;
$function$;

-- Update validate_business_hours function to use UTC
CREATE OR REPLACE FUNCTION public.validate_business_hours(check_time timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT 
    EXTRACT(hour FROM check_time AT TIME ZONE 'UTC') >= 8 
    AND 
    (EXTRACT(hour FROM check_time AT TIME ZONE 'UTC') < 17 
     OR (EXTRACT(hour FROM check_time AT TIME ZONE 'UTC') = 17 
         AND EXTRACT(minute FROM check_time AT TIME ZONE 'UTC') <= 30))
$function$;

-- Update validate_working_day function to use UTC
CREATE OR REPLACE FUNCTION public.validate_working_day(check_time timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT EXTRACT(dow FROM check_time AT TIME ZONE 'UTC') BETWEEN 1 AND 5
$function$;