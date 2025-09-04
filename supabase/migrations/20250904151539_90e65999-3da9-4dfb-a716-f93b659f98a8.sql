-- Problem #2: Working Hours Enhancement - Add lunch break fields to shift_schedules and create holiday management
-- Also fix security issues with new tables

-- Add lunch break fields to shift_schedules table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'shift_schedules' 
                   AND column_name = 'lunch_break_start_time') THEN
        ALTER TABLE shift_schedules 
        ADD COLUMN lunch_break_start_time TIME DEFAULT '12:00:00';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'shift_schedules' 
                   AND column_name = 'lunch_break_duration_minutes') THEN
        ALTER TABLE shift_schedules 
        ADD COLUMN lunch_break_duration_minutes INTEGER DEFAULT 30;
    END IF;
END $$;

-- Create public_holidays table for better holiday management
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  recurring_type TEXT DEFAULT 'none', -- none, annual, weekly
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS on public_holidays
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public_holidays
CREATE POLICY "Allow authenticated users to view holidays" 
ON public.public_holidays 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow admins to manage holidays" 
ON public.public_holidays 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
));

-- Update existing is_working_day function to use enhanced holiday table
CREATE OR REPLACE FUNCTION public.is_working_day(p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT COALESCE(ss.is_working_day, false)
         AND NOT EXISTS (
           SELECT 1 FROM public_holidays ph
           WHERE ph.date = p_date AND ph.is_active = true
         )
  FROM shift_schedules ss
  WHERE ss.day_of_week = EXTRACT(dow FROM p_date)::int
  LIMIT 1;
$function$;

-- Enhanced shift_window function that includes lunch break information
CREATE OR REPLACE FUNCTION public.shift_window_enhanced(p_date date)
RETURNS TABLE(
  win_start timestamp with time zone, 
  win_end timestamp with time zone,
  lunch_start timestamp with time zone,
  lunch_end timestamp with time zone,
  has_lunch_break boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT
    (p_date::timestamptz + ss.shift_start_time) as win_start,
    (p_date::timestamptz + ss.shift_end_time) as win_end,
    CASE WHEN ss.lunch_break_start_time IS NOT NULL AND ss.lunch_break_duration_minutes > 0
         THEN (p_date::timestamptz + ss.lunch_break_start_time)
         ELSE NULL 
    END as lunch_start,
    CASE WHEN ss.lunch_break_start_time IS NOT NULL AND ss.lunch_break_duration_minutes > 0
         THEN (p_date::timestamptz + ss.lunch_break_start_time + make_interval(mins => ss.lunch_break_duration_minutes))
         ELSE NULL 
    END as lunch_end,
    (ss.lunch_break_start_time IS NOT NULL AND ss.lunch_break_duration_minutes > 0) as has_lunch_break
  FROM shift_schedules ss
  WHERE ss.day_of_week = EXTRACT(dow FROM p_date)::int
    AND COALESCE(ss.is_active, true) = true
  LIMIT 1;
$function$;

-- Update place_duration_sql to use the enhanced working hours logic
CREATE OR REPLACE FUNCTION public.place_duration_sql(
  p_earliest_start timestamp with time zone, 
  p_duration_minutes integer, 
  p_max_days integer DEFAULT 30
)
RETURNS TABLE(placement_success boolean, slots_created jsonb)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
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
$function$;

-- Insert some default holidays
INSERT INTO public_holidays (date, name, description, is_active) VALUES
('2025-01-01', 'New Year''s Day', 'First day of the year', true),
('2025-12-25', 'Christmas Day', 'Christmas holiday', true),
('2025-07-04', 'Independence Day', 'US Independence Day', true)
ON CONFLICT (date) DO NOTHING;

-- Update shift_schedules with lunch break defaults if needed
UPDATE shift_schedules 
SET lunch_break_start_time = '12:00:00',
    lunch_break_duration_minutes = 30
WHERE lunch_break_start_time IS NULL;

-- Add search paths to functions to fix security warnings
CREATE OR REPLACE FUNCTION public.get_actual_stage_end_time(p_stage_instance_id uuid)
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT COALESCE(
    jsi.scheduled_end_at,
    jsi.completed_at,
    -- Fallback: if both are null, use start time + estimated duration
    (jsi.started_at + make_interval(mins => COALESCE(jsi.estimated_duration_minutes, 60)))
  )
  FROM job_stage_instances jsi
  WHERE jsi.id = p_stage_instance_id;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_job_completion_barrier(p_job_id uuid, p_current_stage_order integer, p_part_assignment text DEFAULT 'main'::text)
RETURNS timestamp with time zone
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  max_end_time timestamptz;
  base_time timestamptz := now();
BEGIN
  -- Find the maximum actual end time from all completed/active stages at previous orders
  SELECT GREATEST(
    base_time,
    COALESCE(MAX(
      CASE 
        WHEN jsi.status = 'completed' THEN 
          COALESCE(jsi.completed_at, jsi.scheduled_end_at)
        WHEN jsi.status = 'active' AND jsi.started_at IS NOT NULL THEN
          (jsi.started_at + make_interval(mins => COALESCE(jsi.estimated_duration_minutes, 60)))
        ELSE 
          jsi.scheduled_end_at
      END
    ), base_time)
  ) INTO max_end_time
  FROM job_stage_instances jsi
  WHERE jsi.job_id = p_job_id
    AND jsi.stage_order < p_current_stage_order
    AND (
      p_part_assignment = 'main' OR 
      jsi.part_assignment = p_part_assignment OR 
      jsi.part_assignment = 'both' OR
      jsi.part_assignment IS NULL
    )
    AND jsi.status IN ('completed', 'active', 'scheduled');

  RETURN COALESCE(max_end_time, base_time);
END;
$function$;

-- Update other key functions with search_path
CREATE OR REPLACE FUNCTION public.next_working_start(p_from timestamp with time zone)
RETURNS timestamp with time zone
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  ts timestamptz := date_trunc('minute', p_from);
  wd date;
  s timestamptz;
  e timestamptz;
  guard int := 0;
BEGIN
  LOOP
    guard := guard + 1;
    IF guard > 365 THEN
      RAISE EXCEPTION 'next_working_start guard tripped for %', p_from;
    END IF;

    wd := ts::date;
    SELECT win_start, win_end INTO s, e FROM public.shift_window(wd);

    IF s IS NOT NULL AND public.is_working_day(wd) THEN
      IF ts < s THEN
        RETURN s; -- before shift -> start at shift open
      ELSIF ts >= s AND ts < e THEN
        RETURN ts; -- inside shift -> ok
      END IF;
    END IF;

    -- push to next day 08:00 by leveraging next day shift start
    ts := (wd + 1)::timestamptz + time '08:00';
  END LOOP;
END;
$function$;