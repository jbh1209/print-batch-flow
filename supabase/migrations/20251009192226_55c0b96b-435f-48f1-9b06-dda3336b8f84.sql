-- Fix business hours validation to support multi-day time slots
DROP FUNCTION IF EXISTS public.validate_time_slot_business_hours() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_time_slot_business_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  day_start timestamptz;
  day_end timestamptz;
  slot_start_on_day timestamptz;
  slot_end_on_day timestamptz;
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
        -- First day: use actual start time
        slot_start_on_day := NEW.slot_start_time;
      ELSE
        -- Subsequent days: start at business hours
        slot_start_on_day := day_start;
      END IF;
      
      IF check_date = NEW.slot_end_time::date THEN
        -- Last day: use actual end time
        slot_end_on_day := NEW.slot_end_time;
      ELSE
        -- Earlier days: end at business hours
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
      
      -- Check lunch break overlap for this day
      IF slot_start_on_day::time < lunch_end AND slot_end_on_day::time > lunch_start THEN
        RAISE EXCEPTION 'Multi-day slot overlaps lunch break on % (% to %)', 
          check_date, slot_start_on_day::time, slot_end_on_day::time;
      END IF;
      
      -- Move to next day
      check_date := check_date + interval '1 day';
    END LOOP;
    
    RAISE NOTICE 'Multi-day slot validated successfully: % to %', NEW.slot_start_time, NEW.slot_end_time;
  ELSE
    -- Single-day slot validation (existing logic)
    day_start := (NEW.slot_start_time::date || ' ' || business_start)::timestamptz;
    day_end := (NEW.slot_start_time::date || ' ' || business_end)::timestamptz;
    
    IF NEW.slot_start_time < day_start OR NEW.slot_end_time > day_end THEN
      RAISE EXCEPTION 'Time slot (% to %) violates business hours (08:00-16:30)',
        NEW.slot_start_time, NEW.slot_end_time;
    END IF;
    
    -- Check lunch break overlap
    IF NEW.slot_start_time::time < lunch_end AND NEW.slot_end_time::time > lunch_start THEN
      RAISE EXCEPTION 'Time slot (% to %) overlaps lunch break (13:00-14:00)',
        NEW.slot_start_time, NEW.slot_end_time;
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