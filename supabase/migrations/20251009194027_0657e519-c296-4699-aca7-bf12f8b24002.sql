-- Add tolerance for lunch break micro-overlaps caused by scheduler rounding
DROP FUNCTION IF EXISTS public.validate_time_slot_business_hours() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_time_slot_business_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  tolerance_minutes integer := 2;  -- Allow 2-minute tolerance for rounding issues
  day_start timestamptz;
  day_end timestamptz;
  slot_start_on_day timestamptz;
  slot_end_on_day timestamptz;
  lunch_start_ts timestamptz;
  lunch_end_ts timestamptz;
  overlap_minutes integer;
  business_start time := '08:00:00';
  business_end time := '16:30:00';
  lunch_start time := '13:00:00';
  lunch_end time := '14:00:00';
  check_date date;
  end_date date;
BEGIN
  -- Skip validation for NULL timestamps
  IF NEW.slot_start_time IS NULL OR NEW.slot_end_time IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if slot spans multiple days
  IF NEW.slot_end_time::date > NEW.slot_start_time::date THEN
    -- Multi-day slot validation
    check_date := NEW.slot_start_time::date;
    end_date := NEW.slot_end_time::date;
    
    -- Validate each day in the range
    WHILE check_date <= end_date LOOP
      -- Calculate business hours window for this day
      day_start := (check_date || ' ' || business_start)::timestamptz;
      day_end := (check_date || ' ' || business_end)::timestamptz;
      
      -- Determine the slot portion for this day
      IF check_date = NEW.slot_start_time::date THEN
        slot_start_on_day := NEW.slot_start_time;
      ELSE
        slot_start_on_day := day_start;
      END IF;
      
      IF check_date = NEW.slot_end_time::date THEN
        slot_end_on_day := NEW.slot_end_time;
      ELSE
        slot_end_on_day := day_end;
      END IF;
      
      -- Validate this day's portion is within business hours
      IF slot_start_on_day::time < business_start OR slot_start_on_day::time > business_end THEN
        RAISE EXCEPTION 'Multi-day slot starts outside business hours on % (start: %)', 
          check_date, slot_start_on_day::time;
      END IF;
      
      IF slot_end_on_day::time < business_start OR slot_end_on_day::time > business_end THEN
        RAISE EXCEPTION 'Multi-day slot ends outside business hours on % (end: %)', 
          check_date, slot_end_on_day::time;
      END IF;
      
      -- Check lunch break overlap with tolerance
      lunch_start_ts := (check_date || ' ' || lunch_start)::timestamptz;
      lunch_end_ts := (check_date || ' ' || lunch_end)::timestamptz;
      
      IF slot_start_on_day < lunch_end_ts AND slot_end_on_day > lunch_start_ts THEN
        -- Calculate actual overlap in minutes
        overlap_minutes := EXTRACT(EPOCH FROM (
          LEAST(slot_end_on_day, lunch_end_ts) - GREATEST(slot_start_on_day, lunch_start_ts)
        ))::integer / 60;
        
        IF overlap_minutes > tolerance_minutes THEN
          RAISE EXCEPTION 'Multi-day slot overlaps lunch break on % by % minutes (% to %) - exceeds tolerance of % minutes', 
            check_date, overlap_minutes, slot_start_on_day::time, slot_end_on_day::time, tolerance_minutes;
        ELSE
          RAISE NOTICE 'Multi-day slot on % has %-minute lunch overlap - allowed within tolerance', 
            check_date, overlap_minutes;
        END IF;
      END IF;
      
      check_date := check_date + interval '1 day';
    END LOOP;
    
    RAISE NOTICE 'Multi-day slot validated successfully: % to %', NEW.slot_start_time, NEW.slot_end_time;
  ELSE
    -- Single-day slot validation with tolerance
    day_start := (NEW.slot_start_time::date || ' ' || business_start)::timestamptz;
    day_end := (NEW.slot_start_time::date || ' ' || business_end)::timestamptz;
    
    IF NEW.slot_start_time < day_start OR NEW.slot_end_time > day_end THEN
      RAISE EXCEPTION 'Time slot (% to %) violates business hours (08:00-16:30)',
        NEW.slot_start_time, NEW.slot_end_time;
    END IF;
    
    -- Check lunch break overlap with tolerance
    lunch_start_ts := (NEW.slot_start_time::date || ' ' || lunch_start)::timestamptz;
    lunch_end_ts := (NEW.slot_start_time::date || ' ' || lunch_end)::timestamptz;
    
    IF NEW.slot_start_time < lunch_end_ts AND NEW.slot_end_time > lunch_start_ts THEN
      -- Calculate actual overlap in minutes
      overlap_minutes := EXTRACT(EPOCH FROM (
        LEAST(NEW.slot_end_time, lunch_end_ts) - GREATEST(NEW.slot_start_time, lunch_start_ts)
      ))::integer / 60;
      
      IF overlap_minutes > tolerance_minutes THEN
        RAISE EXCEPTION 'Time slot (% to %) overlaps lunch break by % minutes - exceeds tolerance of % minutes',
          NEW.slot_start_time, NEW.slot_end_time, overlap_minutes, tolerance_minutes;
      ELSE
        RAISE NOTICE 'Slot % to % has %-minute lunch overlap - allowed within tolerance', 
          NEW.slot_start_time::time, NEW.slot_end_time::time, overlap_minutes;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS validate_business_hours ON public.stage_time_slots;
CREATE TRIGGER validate_business_hours
  BEFORE INSERT OR UPDATE ON public.stage_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_time_slot_business_hours();