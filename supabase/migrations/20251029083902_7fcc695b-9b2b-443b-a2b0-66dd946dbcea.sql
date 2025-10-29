-- ============================================================================
-- RESTORE OCTOBER 12TH WORKING SCHEDULER
-- ============================================================================
-- Problem: place_duration_sql has GREATEST(..., now()) clamp breaking tailing/gap-filling
-- Solution: Remove the clamp, restore original next_working_start logic
-- ============================================================================

-- Fix #1: Restore place_duration_sql to allow tailing into earlier available capacity
CREATE OR REPLACE FUNCTION public.place_duration_sql(
  p_earliest_start timestamp with time zone,
  p_duration_minutes integer,
  p_max_days integer DEFAULT 30
)
RETURNS TABLE(placement_success boolean, slots_created jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_day date;
  shift_info record;
  available_start timestamptz;
  remaining_minutes integer := p_duration_minutes;
  slots jsonb := '[]'::jsonb;
  day_count integer := 0;
  slot_start timestamptz;
  slot_end timestamptz;
  slot_duration integer;
  morning_capacity integer;
  afternoon_capacity integer;
BEGIN
  -- Validate inputs
  IF p_duration_minutes <= 0 THEN
    RETURN QUERY SELECT false, '[]'::jsonb;
    RETURN;
  END IF;

  -- RESTORED: Use next_working_start directly (no now() clamp)
  -- This allows gap-filling to place stages into earlier available capacity
  available_start := public.next_working_start(p_earliest_start);
  current_day := available_start::date;

  WHILE remaining_minutes > 0 AND day_count < p_max_days LOOP
    day_count := day_count + 1;
    
    -- Skip non-working days
    IF NOT public.is_working_day(current_day) THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
      CONTINUE;
    END IF;

    -- Get enhanced shift information including lunch breaks
    SELECT * INTO shift_info
    FROM public.shift_window_enhanced(current_day);
    
    IF shift_info.win_start IS NULL OR shift_info.win_end IS NULL THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
      CONTINUE;
    END IF;

    -- Ensure we start no earlier than shift start and no earlier than available_start
    slot_start := GREATEST(available_start, shift_info.win_start);
    
    -- Handle lunch break if configured
    IF shift_info.has_lunch_break THEN
      -- Morning slot before lunch
      IF slot_start < shift_info.lunch_start THEN
        morning_capacity := GREATEST(0, EXTRACT(epoch FROM (shift_info.lunch_start - slot_start)) / 60)::integer;
        IF morning_capacity > 0 THEN
          slot_duration := LEAST(remaining_minutes, morning_capacity);
          slot_end := slot_start + make_interval(mins => slot_duration);
          
          slots := slots || jsonb_build_object(
            'start_time', slot_start,
            'end_time', slot_end,
            'duration_minutes', slot_duration,
            'date', current_day
          );
          
          remaining_minutes := remaining_minutes - slot_duration;
        END IF;
        
        -- Continue after lunch if more time needed
        IF remaining_minutes > 0 AND shift_info.lunch_end < shift_info.win_end THEN
          afternoon_capacity := GREATEST(0, EXTRACT(epoch FROM (shift_info.win_end - shift_info.lunch_end)) / 60)::integer;
          IF afternoon_capacity > 0 THEN
            slot_duration := LEAST(remaining_minutes, afternoon_capacity);
            slot_end := shift_info.lunch_end + make_interval(mins => slot_duration);
            
            slots := slots || jsonb_build_object(
              'start_time', shift_info.lunch_end,
              'end_time', slot_end,
              'duration_minutes', slot_duration,
              'date', current_day
            );
            
            remaining_minutes := remaining_minutes - slot_duration;
          END IF;
        END IF;
      ELSE
        -- Start after lunch
        slot_start := GREATEST(slot_start, shift_info.lunch_end);
        IF slot_start < shift_info.win_end THEN
          afternoon_capacity := GREATEST(0, EXTRACT(epoch FROM (shift_info.win_end - slot_start)) / 60)::integer;
          IF afternoon_capacity > 0 THEN
            slot_duration := LEAST(remaining_minutes, afternoon_capacity);
            slot_end := slot_start + make_interval(mins => slot_duration);
            
            slots := slots || jsonb_build_object(
              'start_time', slot_start,
              'end_time', slot_end,
              'duration_minutes', slot_duration,
              'date', current_day
            );
            
            remaining_minutes := remaining_minutes - slot_duration;
          END IF;
        END IF;
      END IF;
    ELSE
      -- No lunch break - simple placement
      slot_duration := LEAST(remaining_minutes, GREATEST(0, EXTRACT(epoch FROM (shift_info.win_end - slot_start)) / 60)::integer);
      
      IF slot_duration > 0 THEN
        slot_end := slot_start + make_interval(mins => slot_duration);
        
        slots := slots || jsonb_build_object(
          'start_time', slot_start,
          'end_time', slot_end,
          'duration_minutes', slot_duration,
          'date', current_day
        );
        
        remaining_minutes := remaining_minutes - slot_duration;
      END IF;
    END IF;
    
    -- Move to next day if more time needed
    IF remaining_minutes > 0 THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
    END IF;
  END LOOP;

  -- Return success if we placed all minutes within the day limit
  RETURN QUERY SELECT (remaining_minutes = 0), slots;
END;
$$;

COMMENT ON FUNCTION public.place_duration_sql IS 'October 12th working version - restored to allow proper gap-filling and tailing. Uses next_working_start without now() clamp to enable scheduling into earlier available capacity.';