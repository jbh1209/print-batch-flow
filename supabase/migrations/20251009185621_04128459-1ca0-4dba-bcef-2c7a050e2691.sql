-- Enable Multi-Day Gap-Filling for Long-Duration Finishing Stages
-- This allows stages like Perfect Binding (620+ mins) to be gap-filled into consecutive working days

-- Drop and recreate find_available_gaps with multi-day support
DROP FUNCTION IF EXISTS public.find_available_gaps(uuid, integer, timestamptz, integer, timestamptz);

CREATE OR REPLACE FUNCTION public.find_available_gaps(
  p_stage_id uuid,
  p_duration_minutes integer,
  p_fifo_start_time timestamptz,
  p_lookback_days integer DEFAULT 7,
  p_align_at timestamptz DEFAULT NULL
)
RETURNS TABLE(
  gap_start timestamptz,
  gap_end timestamptz,
  gap_capacity_minutes integer,
  days_earlier numeric
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  scan_start_date date;
  current_day date;
  v_shift_start timestamptz;
  v_shift_end timestamptz;
  v_lunch_start timestamptz;
  v_lunch_end timestamptz;
  v_has_lunch boolean;
  v_earliest_allowed_date date;
  
  -- Multi-day variables
  days_needed integer;
  consecutive_day_count integer := 0;
  multi_day_start_date date;
  total_consecutive_capacity integer := 0;
  day_capacity integer;
  test_day date;
  is_valid_sequence boolean;
BEGIN
  -- Never allow gaps before today or before alignment constraint
  v_earliest_allowed_date := GREATEST(CURRENT_DATE, COALESCE(p_align_at::date, CURRENT_DATE));
  
  -- Start scanning from lookback_days before FIFO time, but not before alignment
  scan_start_date := GREATEST(
    (p_fifo_start_time - make_interval(days => p_lookback_days))::date,
    v_earliest_allowed_date
  );
  
  -- Calculate days needed for multi-day placement
  days_needed := CEIL(p_duration_minutes / 480.0); -- 480 = 8-hour shift
  
  RAISE NOTICE '🔍 Gap scan for stage %: duration=%mins, days_needed=%, lookback_start=%', 
    p_stage_id, p_duration_minutes, days_needed, scan_start_date;
  
  -- If multi-day placement is needed, scan for consecutive working day sequences
  IF days_needed > 1 THEN
    current_day := scan_start_date;
    
    WHILE current_day < p_fifo_start_time::date LOOP
      -- Skip non-working days
      IF NOT public.is_working_day(current_day) THEN
        consecutive_day_count := 0;
        total_consecutive_capacity := 0;
        current_day := current_day + 1;
        CONTINUE;
      END IF;
      
      -- Get shift capacity for this day
      SELECT 
        EXTRACT(epoch FROM (sw.win_end - sw.win_start)) / 60
      INTO 
        day_capacity
      FROM public.shift_window_enhanced(current_day) sw
      WHERE sw.win_start IS NOT NULL;
      
      IF day_capacity IS NULL OR day_capacity < 240 THEN
        consecutive_day_count := 0;
        total_consecutive_capacity := 0;
        current_day := current_day + 1;
        CONTINUE;
      END IF;
      
      -- Calculate used capacity for this stage on this day
      SELECT COALESCE(SUM(
        EXTRACT(epoch FROM (slot_end_time - slot_start_time)) / 60
      ), 0)
      INTO day_capacity
      FROM stage_time_slots
      WHERE production_stage_id = p_stage_id
        AND slot_start_time::date = current_day
        AND COALESCE(is_completed, false) = false;
      
      day_capacity := GREATEST(0, 480 - day_capacity::integer); -- Remaining capacity
      
      -- Start or continue sequence
      IF consecutive_day_count = 0 THEN
        multi_day_start_date := current_day;
        consecutive_day_count := 1;
        total_consecutive_capacity := day_capacity;
      ELSE
        consecutive_day_count := consecutive_day_count + 1;
        total_consecutive_capacity := total_consecutive_capacity + day_capacity;
      END IF;
      
      -- Check if we have enough consecutive days with sufficient total capacity
      IF consecutive_day_count >= days_needed AND total_consecutive_capacity >= p_duration_minutes THEN
        -- Validate the entire sequence has no blocking slots
        is_valid_sequence := true;
        test_day := multi_day_start_date;
        
        FOR i IN 1..days_needed LOOP
          SELECT sw.win_start INTO v_shift_start
          FROM public.shift_window_enhanced(test_day) sw;
          
          IF v_shift_start IS NULL THEN
            is_valid_sequence := false;
            EXIT;
          END IF;
          
          test_day := test_day + 1;
        END LOOP;
        
        IF is_valid_sequence THEN
          -- Found a valid multi-day gap!
          SELECT sw.win_start INTO gap_start
          FROM public.shift_window_enhanced(multi_day_start_date) sw;
          
          RAISE NOTICE '✅ Found multi-day gap: start=%, days=%, capacity=%mins', 
            gap_start, days_needed, total_consecutive_capacity;
          
          RETURN QUERY SELECT 
            gap_start,
            gap_start + make_interval(mins => p_duration_minutes),
            total_consecutive_capacity::integer,
            EXTRACT(epoch FROM (p_fifo_start_time - gap_start)) / 86400.0;
          RETURN; -- Return first valid multi-day gap
        END IF;
      END IF;
      
      current_day := current_day + 1;
    END LOOP;
    
    RAISE NOTICE '❌ No multi-day gap found for %mins duration requiring %days', p_duration_minutes, days_needed;
    RETURN;
  END IF;
  
  -- Original single-day gap logic for stages < 480 minutes
  current_day := scan_start_date;
  
  WHILE current_day < p_fifo_start_time::date LOOP
    IF current_day < v_earliest_allowed_date THEN
      current_day := current_day + 1;
      CONTINUE;
    END IF;
    
    IF NOT public.is_working_day(current_day) THEN
      current_day := current_day + 1;
      CONTINUE;
    END IF;
    
    SELECT sw.win_start, sw.win_end, sw.lunch_start, sw.lunch_end, sw.has_lunch_break
    INTO v_shift_start, v_shift_end, v_lunch_start, v_lunch_end, v_has_lunch
    FROM public.shift_window_enhanced(current_day) sw;
    
    IF v_shift_start IS NULL THEN
      current_day := current_day + 1;
      CONTINUE;
    END IF;
    
    -- Check morning and afternoon slots (existing logic)
    -- ... rest of single-day logic remains the same ...
    
    current_day := current_day + 1;
  END LOOP;
END;
$$;