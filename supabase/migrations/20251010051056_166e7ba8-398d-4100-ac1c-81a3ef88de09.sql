-- Simplify time slot validation: remove lunch checks, keep only business hours validation
CREATE OR REPLACE FUNCTION public.validate_time_slot_business_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  check_date date;
  day_segment text;
  day_start_time timestamptz;
  day_end_time timestamptz;
  shift_info record;
BEGIN
  -- Multi-day slot validation
  IF NEW.slot_start_time::date != NEW.slot_end_time::date THEN
    check_date := NEW.slot_start_time::date;
    
    WHILE check_date <= NEW.slot_end_time::date LOOP
      -- Get shift configuration for this specific day
      SELECT 
        (check_date::timestamptz + ss.shift_start_time) as win_start,
        (check_date::timestamptz + ss.shift_end_time) as win_end
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
      
      -- Validate business hours for this day segment (NO LUNCH CHECK)
      IF day_start_time < shift_info.win_start OR day_end_time > shift_info.win_end THEN
        RAISE EXCEPTION 'Multi-day slot segment (%) on % violates business hours (%-%). Slot: % to %',
          day_segment, check_date, shift_info.win_start, shift_info.win_end, day_start_time, day_end_time
          USING ERRCODE = 'P0001';
      END IF;
      
      check_date := check_date + 1;
    END LOOP;
    
    RETURN NEW;
  END IF;
  
  -- Single-day slot validation
  SELECT 
    (NEW.slot_start_time::date::timestamptz + ss.shift_start_time) as win_start,
    (NEW.slot_start_time::date::timestamptz + ss.shift_end_time) as win_end
  INTO shift_info
  FROM shift_schedules ss
  WHERE ss.day_of_week = EXTRACT(dow FROM NEW.slot_start_time::date)::int
    AND COALESCE(ss.is_active, true) = true
  LIMIT 1;
  
  IF shift_info.win_start IS NULL THEN
    RAISE EXCEPTION 'No shift configuration found for date %', NEW.slot_start_time::date;
  END IF;
  
  -- Validate business hours only (NO LUNCH CHECK)
  IF NEW.slot_start_time < shift_info.win_start OR NEW.slot_end_time > shift_info.win_end THEN
    RAISE EXCEPTION 'Time slot % to % violates business hours (%-%) on %',
      NEW.slot_start_time, NEW.slot_end_time, shift_info.win_start, shift_info.win_end, NEW.slot_start_time::date
      USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$;