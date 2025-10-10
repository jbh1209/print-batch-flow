-- Drop existing trigger and function
DROP TRIGGER IF EXISTS validate_business_hours ON public.stage_time_slots;
DROP FUNCTION IF EXISTS public.validate_time_slot_business_hours();

-- Create updated validation function that uses shift_schedules table
CREATE OR REPLACE FUNCTION public.validate_time_slot_business_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  tolerance_minutes integer := 2;
  check_date date;
  day_segment text;
  day_start_time timestamptz;
  day_end_time timestamptz;
  shift_info record;
  overlap_minutes integer;
BEGIN
  -- Multi-day slot validation
  IF NEW.slot_start_time::date != NEW.slot_end_time::date THEN
    check_date := NEW.slot_start_time::date;
    
    WHILE check_date <= NEW.slot_end_time::date LOOP
      -- Get shift configuration for this specific day from shift_schedules
      SELECT 
        (check_date::timestamptz + ss.shift_start_time) as win_start,
        (check_date::timestamptz + ss.shift_end_time) as win_end,
        CASE WHEN ss.lunch_break_start_time IS NOT NULL AND ss.lunch_break_duration_minutes > 0
             THEN (check_date::timestamptz + ss.lunch_break_start_time)
             ELSE NULL 
        END as lunch_start,
        CASE WHEN ss.lunch_break_start_time IS NOT NULL AND ss.lunch_break_duration_minutes > 0
             THEN (check_date::timestamptz + ss.lunch_break_start_time + make_interval(mins => ss.lunch_break_duration_minutes))
             ELSE NULL 
        END as lunch_end
      INTO shift_info
      FROM shift_schedules ss
      WHERE ss.day_of_week = EXTRACT(dow FROM check_date)::int
        AND COALESCE(ss.is_active, true) = true
      LIMIT 1;
      
      IF shift_info.win_start IS NULL THEN
        RAISE EXCEPTION 'No shift configuration found for date %', check_date;
      END IF;
      
      -- Determine segment boundaries for this day
      IF check_date = NEW.slot_start_time::date AND check_date = NEW.slot_end_time::date THEN
        day_segment := 'single';
        day_start_time := NEW.slot_start_time;
        day_end_time := NEW.slot_end_time;
      ELSIF check_date = NEW.slot_start_time::date THEN
        day_segment := 'first';
        day_start_time := NEW.slot_start_time;
        day_end_time := shift_info.win_end;
      ELSIF check_date = NEW.slot_end_time::date THEN
        day_segment := 'last';
        day_start_time := shift_info.win_start;
        day_end_time := NEW.slot_end_time;
      ELSE
        day_segment := 'middle';
        day_start_time := shift_info.win_start;
        day_end_time := shift_info.win_end;
      END IF;
      
      -- Validate business hours for this day segment
      IF day_start_time < shift_info.win_start OR day_end_time > shift_info.win_end THEN
        RAISE EXCEPTION 'Multi-day slot segment (%) on % violates business hours (%-%). Slot: % to %',
          day_segment, check_date, shift_info.win_start, shift_info.win_end, day_start_time, day_end_time
          USING ERRCODE = 'P0001';
      END IF;
      
      -- Check lunch overlap with tolerance
      IF shift_info.lunch_start IS NOT NULL AND shift_info.lunch_end IS NOT NULL THEN
        overlap_minutes := GREATEST(0,
          EXTRACT(epoch FROM (
            LEAST(day_end_time, shift_info.lunch_end) - 
            GREATEST(day_start_time, shift_info.lunch_start)
          )) / 60
        )::integer;
        
        IF overlap_minutes > tolerance_minutes THEN
          RAISE EXCEPTION 'Multi-day slot segment (%) on % overlaps lunch break (%-%) by % minutes (tolerance: %)',
            day_segment, check_date, shift_info.lunch_start, shift_info.lunch_end, overlap_minutes, tolerance_minutes
            USING ERRCODE = 'P0001';
        ELSIF overlap_minutes > 0 THEN
          RAISE NOTICE 'Multi-day slot segment (%) on % has % minute lunch overlap (within % min tolerance)',
            day_segment, check_date, overlap_minutes, tolerance_minutes;
        END IF;
      END IF;
      
      check_date := check_date + 1;
    END LOOP;
    
    RETURN NEW;
  END IF;
  
  -- Single-day slot validation
  SELECT 
    (NEW.slot_start_time::date::timestamptz + ss.shift_start_time) as win_start,
    (NEW.slot_start_time::date::timestamptz + ss.shift_end_time) as win_end,
    CASE WHEN ss.lunch_break_start_time IS NOT NULL AND ss.lunch_break_duration_minutes > 0
         THEN (NEW.slot_start_time::date::timestamptz + ss.lunch_break_start_time)
         ELSE NULL 
    END as lunch_start,
    CASE WHEN ss.lunch_break_start_time IS NOT NULL AND ss.lunch_break_duration_minutes > 0
         THEN (NEW.slot_start_time::date::timestamptz + ss.lunch_break_start_time + make_interval(mins => ss.lunch_break_duration_minutes))
         ELSE NULL 
    END as lunch_end
  INTO shift_info
  FROM shift_schedules ss
  WHERE ss.day_of_week = EXTRACT(dow FROM NEW.slot_start_time::date)::int
    AND COALESCE(ss.is_active, true) = true
  LIMIT 1;
  
  IF shift_info.win_start IS NULL THEN
    RAISE EXCEPTION 'No shift configuration found for date %', NEW.slot_start_time::date;
  END IF;
  
  -- Validate business hours
  IF NEW.slot_start_time < shift_info.win_start OR NEW.slot_end_time > shift_info.win_end THEN
    RAISE EXCEPTION 'Time slot % to % violates business hours (%-%) on %',
      NEW.slot_start_time, NEW.slot_end_time, shift_info.win_start, shift_info.win_end, NEW.slot_start_time::date
      USING ERRCODE = 'P0001';
  END IF;
  
  -- Check lunch overlap with tolerance
  IF shift_info.lunch_start IS NOT NULL AND shift_info.lunch_end IS NOT NULL THEN
    overlap_minutes := GREATEST(0,
      EXTRACT(epoch FROM (
        LEAST(NEW.slot_end_time, shift_info.lunch_end) - 
        GREATEST(NEW.slot_start_time, shift_info.lunch_start)
      )) / 60
    )::integer;
    
    IF overlap_minutes > tolerance_minutes THEN
      RAISE EXCEPTION 'Time slot % to % overlaps lunch break (%-%) by % minutes (tolerance: %) on %',
        NEW.slot_start_time, NEW.slot_end_time, shift_info.lunch_start, shift_info.lunch_end, 
        overlap_minutes, tolerance_minutes, NEW.slot_start_time::date
        USING ERRCODE = 'P0001';
    ELSIF overlap_minutes > 0 THEN
      RAISE NOTICE 'Time slot % to % has % minute lunch overlap (within % min tolerance)',
        NEW.slot_start_time, NEW.slot_end_time, overlap_minutes, tolerance_minutes;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER validate_business_hours
  BEFORE INSERT OR UPDATE ON public.stage_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_time_slot_business_hours();