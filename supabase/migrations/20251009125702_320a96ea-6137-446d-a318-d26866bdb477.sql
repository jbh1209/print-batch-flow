-- Fix function overload ambiguity in find_available_gaps
-- Remove DEFAULT on p_align_at parameter to allow unambiguous 4-arg calls

DROP FUNCTION IF EXISTS public.find_available_gaps(uuid, integer, timestamptz, integer, timestamptz);

-- Recreate 5-argument version WITHOUT default on p_align_at
-- WARNING: Never add DEFAULT to params in overloaded functions - causes ambiguity!
CREATE OR REPLACE FUNCTION public.find_available_gaps(
  p_stage_id uuid, 
  p_duration_minutes integer, 
  p_fifo_start_time timestamptz, 
  p_lookback_days integer,
  p_align_at timestamptz  -- NO DEFAULT - explicit 5th arg required
)
RETURNS TABLE(
  gap_start timestamptz, 
  gap_end timestamptz, 
  gap_capacity_minutes integer, 
  days_earlier numeric
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  scan_start_date date;
  current_day date;
  v_shift_start timestamptz;
  v_shift_end timestamptz;
  v_lunch_start timestamptz;
  v_lunch_end timestamptz;
  v_has_lunch boolean;
  occupied_slots record;
  potential_gap_start timestamptz;
  potential_gap_end timestamptz;
  gap_capacity integer;
  v_earliest_allowed_date date;
BEGIN
  -- CRITICAL FIX: Never allow gaps before today
  v_earliest_allowed_date := CURRENT_DATE;
  
  -- Respect alignment constraint: never schedule before p_align_at
  v_earliest_allowed_date := GREATEST(v_earliest_allowed_date, p_align_at::date);
  
  -- Start scanning from lookback_days before FIFO time, but not before alignment constraint
  scan_start_date := GREATEST(
    (p_fifo_start_time - make_interval(days => p_lookback_days))::date,
    v_earliest_allowed_date
  );
  
  current_day := scan_start_date;
  
  -- Scan forward day by day until we reach FIFO time
  WHILE current_day < p_fifo_start_time::date LOOP
    -- CRITICAL FIX: Skip any day before today or before alignment
    IF current_day < CURRENT_DATE OR current_day < p_align_at::date THEN
      current_day := current_day + 1;
      CONTINUE;
    END IF;
    
    -- Skip non-working days
    IF NOT public.is_working_day(current_day) THEN
      current_day := current_day + 1;
      CONTINUE;
    END IF;
    
    -- Get shift windows for this day
    SELECT 
      sw.win_start, sw.win_end, sw.lunch_start, sw.lunch_end, sw.has_lunch_break
    INTO 
      v_shift_start, v_shift_end, v_lunch_start, v_lunch_end, v_has_lunch
    FROM public.shift_window_enhanced(current_day) sw;
    
    IF v_shift_start IS NULL THEN
      current_day := current_day + 1;
      CONTINUE;
    END IF;
    
    -- Check morning slot (before lunch)
    potential_gap_start := GREATEST(v_shift_start, p_align_at);
    potential_gap_end := COALESCE(v_lunch_start, v_shift_end);
    
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
    IF v_has_lunch THEN
      potential_gap_start := GREATEST(v_lunch_end, p_align_at);
      potential_gap_end := v_shift_end;
      
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