-- Add two-parameter overload for shift_window_enhanced to support date range scanning
-- Used by find_available_gaps() to get working windows across multiple days

CREATE OR REPLACE FUNCTION public.shift_window_enhanced(p_start_date date, p_end_date date)
RETURNS TABLE(start_time timestamptz, end_time timestamptz)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  current_day date := p_start_date;
  win record;
BEGIN
  -- Validate input range
  IF p_end_date IS NULL OR p_start_date IS NULL OR p_start_date >= p_end_date THEN
    RETURN;
  END IF;

  -- Iterate through each day in the range
  WHILE current_day < p_end_date LOOP
    -- Only process working days
    IF public.is_working_day(current_day) THEN
      -- Get the daily window using the existing single-arg function
      SELECT sw.win_start, sw.win_end
      INTO win
      FROM public.shift_window_enhanced(current_day) sw;

      -- Return the window if valid
      IF win.win_start IS NOT NULL AND win.win_end IS NOT NULL THEN
        start_time := win.win_start;
        end_time := win.win_end;
        RETURN NEXT;
      END IF;
    END IF;

    current_day := current_day + 1;
  END LOOP;
END;
$$;