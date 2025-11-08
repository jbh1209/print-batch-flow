-- ============================================================================
-- SCHEDULER RESTORATION - October 24-25, 2025 WORKING STATE
-- ============================================================================
-- SOURCE: DB Dump from October 25, 2025 03:00 AM (docs/db/DB Dump file 1.txt)
-- PURPOSE: Restore the exact working scheduler functions that were operational
--          before subsequent breaking changes were introduced
-- 
-- CRITICAL: These functions are the GOLDEN SOURCE. Any deviations from this
--          code should be carefully tested and documented.
--
-- VERIFIED WORKING BEHAVIOR:
-- - Gap-filling moves 5-20 stages per nightly run
-- - Part-aware parallel scheduling (cover/text/both)
-- - Multi-pass convergence (up to 3 iterations)
-- - Proper predecessor checking with part-aware filtering
-- - No "column does not exist" errors
-- - Nightly cron completes in <30 seconds
-- ============================================================================

-- Drop existing functions cleanly
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.find_available_gaps(uuid, integer, timestamp with time zone, integer, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.cron_nightly_reschedule_with_carryforward() CASCADE;
DROP FUNCTION IF EXISTS public.place_duration_sql(timestamp with time zone, integer, integer) CASCADE;

-- ============================================================================
-- 1. place_duration_sql
-- ============================================================================
-- PURPOSE: Places a duration of work across working days/shifts
-- HANDLES: Lunch breaks, shift windows, multi-day spanning
-- RETURNS: Success flag and array of time slots created
-- ============================================================================

CREATE FUNCTION public.place_duration_sql(
  p_earliest_start timestamp with time zone, 
  p_duration_minutes integer, 
  p_max_days integer DEFAULT 60
) RETURNS TABLE(
  placement_success boolean, 
  slots_created jsonb
)
LANGUAGE plpgsql STABLE
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

  -- Start from the earliest possible working moment
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

ALTER FUNCTION public.place_duration_sql(p_earliest_start timestamp with time zone, p_duration_minutes integer, p_max_days integer) OWNER TO postgres;

-- ============================================================================
-- 2. find_available_gaps
-- ============================================================================
-- PURPOSE: Finds gaps in stage schedule where a stage can be moved earlier
-- HANDLES: Working day windows, shift boundaries, conflict detection
-- RETURNS: Available gaps with start/end times and days_earlier metric
-- ============================================================================

CREATE FUNCTION public.find_available_gaps(
  p_stage_id uuid, 
  p_duration_minutes integer, 
  p_fifo_start_time timestamp with time zone, 
  p_lookback_days integer DEFAULT 21, 
  p_align_at timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS TABLE(
  gap_start timestamp with time zone, 
  gap_end timestamp with time zone, 
  gap_duration_minutes integer, 
  days_earlier numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_earliest_allowed_date date;
  scan_start_date date;
  scan_end_date date;
  day_win record;
  cur_start timestamptz;
  s record;
  effective_gap_minutes integer;
  is_occupied boolean;
BEGIN
  v_earliest_allowed_date := CURRENT_DATE;

  scan_start_date := GREATEST(
    (p_fifo_start_time - make_interval(days => p_lookback_days))::date,
    v_earliest_allowed_date,
    COALESCE(p_align_at::date, v_earliest_allowed_date)
  );

  scan_end_date := (p_fifo_start_time + interval '1 day')::date;

  FOR day_win IN
    SELECT sw.start_time AS win_start, sw.end_time AS win_end
    FROM public.shift_window_enhanced(scan_start_date, scan_end_date) sw
    ORDER BY sw.start_time
  LOOP
    cur_start := GREATEST(day_win.win_start, COALESCE(p_align_at, day_win.win_start));

    FOR s IN
      SELECT 
        GREATEST(sts.slot_start_time, day_win.win_start) AS s_start,
        LEAST(sts.slot_end_time,   day_win.win_end)       AS s_end
      FROM public.stage_time_slots sts
      WHERE sts.production_stage_id = p_stage_id
        AND COALESCE(sts.is_completed, false) = false
        AND sts.slot_start_time < day_win.win_end
        AND sts.slot_end_time   > day_win.win_start
      ORDER BY sts.slot_start_time
    LOOP
      -- Gap before this booking
      IF cur_start < s.s_start THEN
        effective_gap_minutes := FLOOR(EXTRACT(EPOCH FROM (s.s_start - cur_start)) / 60)::integer;
        IF effective_gap_minutes >= p_duration_minutes THEN
          -- CRITICAL FIX: Check if this gap start is already occupied by another stage instance
          SELECT EXISTS(
            SELECT 1 FROM stage_time_slots 
            WHERE production_stage_id = p_stage_id 
              AND slot_start_time = cur_start
              AND COALESCE(is_completed, false) = false
          ) INTO is_occupied;
          
          -- Only return this gap if the start time is NOT occupied
          IF NOT is_occupied THEN
            gap_start := cur_start;
            gap_end := s.s_start;
            gap_duration_minutes := effective_gap_minutes;
            days_earlier := EXTRACT(EPOCH FROM (p_fifo_start_time - gap_start)) / 86400.0;
            RETURN NEXT;
          END IF;
        END IF;
      END IF;

      IF s.s_end > cur_start THEN
        cur_start := s.s_end;
      END IF;

      IF cur_start >= day_win.win_end THEN
        EXIT;
      END IF;
    END LOOP;

    -- Trailing gap after the last booking of the day
    IF cur_start < day_win.win_end THEN
      effective_gap_minutes := FLOOR(EXTRACT(EPOCH FROM (day_win.win_end - cur_start)) / 60)::integer;
      IF effective_gap_minutes >= p_duration_minutes THEN
        -- CRITICAL FIX: Check if this gap start is already occupied by another stage instance
        SELECT EXISTS(
          SELECT 1 FROM stage_time_slots 
          WHERE production_stage_id = p_stage_id 
            AND slot_start_time = cur_start
            AND COALESCE(is_completed, false) = false
        ) INTO is_occupied;
        
        -- Only return this gap if the start time is NOT occupied
        IF NOT is_occupied THEN
          gap_start := cur_start;
          gap_end := day_win.win_end;
          gap_duration_minutes := effective_gap_minutes;
          days_earlier := EXTRACT(EPOCH FROM (p_fifo_start_time - gap_start)) / 86400.0;
          RETURN NEXT;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION public.find_available_gaps(p_stage_id uuid, p_duration_minutes integer, p_fifo_start_time timestamp with time zone, p_lookback_days integer, p_align_at timestamp with time zone) OWNER TO postgres;

-- [Continue in next file due to length - this is part 1]
