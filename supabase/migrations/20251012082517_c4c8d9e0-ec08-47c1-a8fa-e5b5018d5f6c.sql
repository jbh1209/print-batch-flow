-- Fix find_available_gaps to exclude already-occupied start times
-- This prevents duplicate key violations when multiple stages try to book the same slot

CREATE OR REPLACE FUNCTION public.find_available_gaps(
  p_stage_id uuid,
  p_duration_minutes integer,
  p_fifo_start_time timestamp with time zone,
  p_lookback_days integer DEFAULT 21,
  p_align_at timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  gap_start timestamp with time zone,
  gap_end timestamp with time zone,
  gap_duration_minutes integer,
  days_earlier numeric
)
LANGUAGE plpgsql
AS $function$
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
$function$;