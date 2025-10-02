-- Fix find_available_gaps() function - correct column names from shift_window_enhanced()
CREATE OR REPLACE FUNCTION public.find_available_gaps(
  p_stage_id uuid, 
  p_duration_minutes integer, 
  p_fifo_start_time timestamp with time zone, 
  p_lookback_days integer DEFAULT 21
)
RETURNS TABLE(
  gap_start timestamp with time zone, 
  gap_end timestamp with time zone, 
  gap_capacity_minutes integer, 
  days_earlier numeric
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  scan_start_date date;
  current_day date;
  shift_start timestamptz;
  shift_end timestamptz;
  lunch_start timestamptz;
  lunch_end timestamptz;
  has_lunch boolean;
  occupied_slots record;
  potential_gap_start timestamptz;
  potential_gap_end timestamptz;
  gap_capacity integer;
BEGIN
  -- Start scanning from lookback_days before FIFO time
  scan_start_date := (p_fifo_start_time - make_interval(days => p_lookback_days))::date;
  current_day := scan_start_date;
  
  -- Scan forward day by day until we reach FIFO time
  WHILE current_day < p_fifo_start_time::date LOOP
    -- Skip non-working days
    IF NOT public.is_working_day(current_day) THEN
      current_day := current_day + 1;
      CONTINUE;
    END IF;
    
    -- Get shift windows for this day - FIXED: Use correct column names
    SELECT 
      win_start, win_end, lunch_start, lunch_end, has_lunch_break
    INTO 
      shift_start, shift_end, lunch_start, lunch_end, has_lunch
    FROM public.shift_window_enhanced(current_day);
    
    IF shift_start IS NULL THEN
      current_day := current_day + 1;
      CONTINUE;
    END IF;
    
    -- Check morning slot (before lunch)
    potential_gap_start := shift_start;
    potential_gap_end := COALESCE(lunch_start, shift_end);
    
    -- Find occupied slots in this window for THIS STAGE ONLY
    FOR occupied_slots IN
      SELECT slot_start_time, slot_end_time 
      FROM stage_time_slots
      WHERE production_stage_id = p_stage_id
        AND slot_start_time < potential_gap_end
        AND slot_end_time > potential_gap_start
        AND COALESCE(is_completed, false) = false
      ORDER BY slot_start_time
    LOOP
      -- Gap before this occupied slot?
      gap_capacity := EXTRACT(epoch FROM (occupied_slots.slot_start_time - potential_gap_start)) / 60;
      IF gap_capacity >= p_duration_minutes THEN
        RETURN QUERY SELECT 
          potential_gap_start,
          potential_gap_start + make_interval(mins => p_duration_minutes),
          gap_capacity::integer,
          EXTRACT(epoch FROM (p_fifo_start_time - potential_gap_start)) / 86400.0;
      END IF;
      
      -- Move start to after this occupied slot
      potential_gap_start := occupied_slots.slot_end_time;
    END LOOP;
    
    -- Final gap in morning slot
    gap_capacity := EXTRACT(epoch FROM (potential_gap_end - potential_gap_start)) / 60;
    IF gap_capacity >= p_duration_minutes THEN
      RETURN QUERY SELECT 
        potential_gap_start,
        potential_gap_start + make_interval(mins => p_duration_minutes),
        gap_capacity::integer,
        EXTRACT(epoch FROM (p_fifo_start_time - potential_gap_start)) / 86400.0;
    END IF;
    
    -- Check afternoon slot (after lunch) if lunch break exists
    IF has_lunch THEN
      potential_gap_start := lunch_end;
      potential_gap_end := shift_end;
      
      FOR occupied_slots IN
        SELECT slot_start_time, slot_end_time 
        FROM stage_time_slots
        WHERE production_stage_id = p_stage_id
          AND slot_start_time < potential_gap_end
          AND slot_end_time > potential_gap_start
          AND COALESCE(is_completed, false) = false
        ORDER BY slot_start_time
      LOOP
        gap_capacity := EXTRACT(epoch FROM (occupied_slots.slot_start_time - potential_gap_start)) / 60;
        IF gap_capacity >= p_duration_minutes THEN
          RETURN QUERY SELECT 
            potential_gap_start,
            potential_gap_start + make_interval(mins => p_duration_minutes),
            gap_capacity::integer,
            EXTRACT(epoch FROM (p_fifo_start_time - potential_gap_start)) / 86400.0;
        END IF;
        
        potential_gap_start := occupied_slots.slot_end_time;
      END LOOP;
      
      -- Final gap in afternoon slot
      gap_capacity := EXTRACT(epoch FROM (potential_gap_end - potential_gap_start)) / 60;
      IF gap_capacity >= p_duration_minutes THEN
        RETURN QUERY SELECT 
          potential_gap_start,
          potential_gap_start + make_interval(mins => p_duration_minutes),
          gap_capacity::integer,
          EXTRACT(epoch FROM (p_fifo_start_time - potential_gap_start)) / 86400.0;
      END IF;
    END IF;
    
    current_day := current_day + 1;
  END LOOP;
END;
$function$;