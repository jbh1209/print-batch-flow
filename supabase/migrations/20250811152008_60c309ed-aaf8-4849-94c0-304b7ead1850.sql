-- PHASE 1: Working Hours Administration System
-- Extend app_settings table for working hours configuration
INSERT INTO public.app_settings (
  setting_type,
  product_type,
  sla_target_days,
  created_at,
  updated_at
) VALUES (
  'working_hours',
  'global',
  8, -- normal work start hour
  now(),
  now()
), (
  'working_hours_end',
  'global', 
  16, -- normal work end hour
  now(),
  now()
), (
  'working_hours_end_minute',
  'global',
  30, -- work end minute
  now(),
  now()
), (
  'busy_period_active',
  'global',
  0, -- 0 = false, 1 = true
  now(),
  now()
), (
  'busy_period_start_hour',
  'global',
  8, -- busy period start hour
  now(),
  now()
), (
  'busy_period_end_hour',
  'global',
  18, -- busy period end hour (extended)
  now(),
  now()
), (
  'busy_period_end_minute',
  'global',
  0, -- busy period end minute
  now(),
  now()
) ON CONFLICT (setting_type, product_type) DO UPDATE SET
  sla_target_days = EXCLUDED.sla_target_days,
  updated_at = now();

-- PHASE 2: Multi-Day Job Splitting Tracking System
-- Add columns to job_stage_instances for multi-day job splitting
ALTER TABLE public.job_stage_instances 
ADD COLUMN IF NOT EXISTS split_sequence integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_splits integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_split_id uuid REFERENCES public.job_stage_instances(id),
ADD COLUMN IF NOT EXISTS remaining_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_completion_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS split_status text DEFAULT 'complete' CHECK (split_status IN ('complete', 'partial', 'continuation'));

-- Add working hours configuration function
CREATE OR REPLACE FUNCTION public.get_working_hours_config()
RETURNS TABLE(
  work_start_hour integer,
  work_end_hour integer, 
  work_end_minute integer,
  busy_period_active boolean,
  busy_start_hour integer,
  busy_end_hour integer,
  busy_end_minute integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((SELECT sla_target_days FROM public.app_settings WHERE setting_type = 'working_hours' AND product_type = 'global'), 8)::integer,
    COALESCE((SELECT sla_target_days FROM public.app_settings WHERE setting_type = 'working_hours_end' AND product_type = 'global'), 16)::integer,
    COALESCE((SELECT sla_target_days FROM public.app_settings WHERE setting_type = 'working_hours_end_minute' AND product_type = 'global'), 30)::integer,
    COALESCE((SELECT sla_target_days FROM public.app_settings WHERE setting_type = 'busy_period_active' AND product_type = 'global'), 0) = 1,
    COALESCE((SELECT sla_target_days FROM public.app_settings WHERE setting_type = 'busy_period_start_hour' AND product_type = 'global'), 8)::integer,
    COALESCE((SELECT sla_target_days FROM public.app_settings WHERE setting_type = 'busy_period_end_hour' AND product_type = 'global'), 18)::integer,
    COALESCE((SELECT sla_target_days FROM public.app_settings WHERE setting_type = 'busy_period_end_minute' AND product_type = 'global'), 0)::integer;
END;
$$;

-- Add daily capacity tracking with proper multi-day accounting
CREATE TABLE IF NOT EXISTS public.daily_stage_capacity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_stage_id uuid NOT NULL,
  date date NOT NULL,
  planned_capacity_minutes integer NOT NULL DEFAULT 510, -- 8.5 hours default
  scheduled_minutes integer NOT NULL DEFAULT 0,
  available_minutes integer GENERATED ALWAYS AS (planned_capacity_minutes - scheduled_minutes) STORED,
  overflow_to_next_day integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(production_stage_id, date)
);

-- Enable RLS on daily_stage_capacity
ALTER TABLE public.daily_stage_capacity ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for daily_stage_capacity
CREATE POLICY "Allow authenticated users to view daily stage capacity" 
ON public.daily_stage_capacity 
FOR SELECT 
USING (true);

CREATE POLICY "Allow system to manage daily stage capacity" 
ON public.daily_stage_capacity 
FOR ALL 
USING (true);

-- Add function to get or create daily capacity record
CREATE OR REPLACE FUNCTION public.get_or_create_daily_capacity(
  p_stage_id uuid,
  p_date date,
  p_capacity_minutes integer DEFAULT 510
)
RETURNS TABLE(
  id uuid,
  scheduled_minutes integer,
  available_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or get existing capacity record
  INSERT INTO public.daily_stage_capacity (
    production_stage_id,
    date,
    planned_capacity_minutes,
    scheduled_minutes
  ) VALUES (
    p_stage_id,
    p_date,
    p_capacity_minutes,
    0
  ) ON CONFLICT (production_stage_id, date) 
  DO UPDATE SET 
    updated_at = now();
  
  -- Return the record
  RETURN QUERY
  SELECT 
    dsc.id,
    dsc.scheduled_minutes,
    dsc.available_minutes
  FROM public.daily_stage_capacity dsc
  WHERE dsc.production_stage_id = p_stage_id 
    AND dsc.date = p_date;
END;
$$;

-- Add function to update daily capacity after scheduling
CREATE OR REPLACE FUNCTION public.update_daily_capacity_after_scheduling(
  p_stage_id uuid,
  p_date date,
  p_additional_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.daily_stage_capacity
  SET 
    scheduled_minutes = scheduled_minutes + p_additional_minutes,
    updated_at = now()
  WHERE production_stage_id = p_stage_id 
    AND date = p_date;
  
  IF NOT FOUND THEN
    -- Create new record if it doesn't exist
    INSERT INTO public.daily_stage_capacity (
      production_stage_id,
      date,
      planned_capacity_minutes,
      scheduled_minutes
    ) VALUES (
      p_stage_id,
      p_date,
      510, -- default 8.5 hours
      p_additional_minutes
    );
  END IF;
  
  RETURN true;
END;
$$;