-- Add queue_ends_at column to stage_workload_tracking table
ALTER TABLE public.stage_workload_tracking 
ADD COLUMN IF NOT EXISTS queue_ends_at timestamp with time zone;

-- Create function to get current queue end time for a stage
CREATE OR REPLACE FUNCTION public.get_stage_queue_end_time(p_stage_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  queue_end_time timestamp with time zone;
BEGIN
  -- Get the queue end time for the stage on the given date
  SELECT queue_ends_at INTO queue_end_time
  FROM public.stage_workload_tracking
  WHERE production_stage_id = p_stage_id 
    AND date = p_date;
  
  -- If no record exists or queue_ends_at is null, return start of working day
  IF queue_end_time IS NULL THEN
    queue_end_time := (p_date::timestamp + interval '8 hours'); -- 08:00
  END IF;
  
  RETURN queue_end_time;
END;
$$;

-- Create function to update stage queue end time
CREATE OR REPLACE FUNCTION public.update_stage_queue_end_time(
  p_stage_id uuid, 
  p_new_end_time timestamp with time zone,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update the queue end time
  INSERT INTO public.stage_workload_tracking (
    production_stage_id,
    date,
    queue_ends_at,
    committed_hours,
    available_hours,
    queue_length_hours,
    pending_jobs_count,
    active_jobs_count,
    calculated_at,
    updated_at
  ) VALUES (
    p_stage_id,
    p_date,
    p_new_end_time,
    0, -- Default values
    8, -- 8 hour working day
    0,
    0,
    0,
    now(),
    now()
  )
  ON CONFLICT (production_stage_id, date) 
  DO UPDATE SET 
    queue_ends_at = EXCLUDED.queue_ends_at,
    updated_at = now();
  
  RETURN true;
END;
$$;

-- Initialize queue end times based on existing scheduled jobs
DO $$
DECLARE
  stage_record RECORD;
  latest_end_time timestamp with time zone;
  working_day_start timestamp with time zone;
BEGIN
  -- For each production stage, find the latest scheduled end time
  FOR stage_record IN 
    SELECT DISTINCT production_stage_id 
    FROM public.job_stage_instances 
    WHERE scheduled_end_at IS NOT NULL
  LOOP
    -- Get the latest scheduled end time for this stage
    SELECT MAX(scheduled_end_at) INTO latest_end_time
    FROM public.job_stage_instances
    WHERE production_stage_id = stage_record.production_stage_id
      AND scheduled_end_at IS NOT NULL;
    
    -- If we found scheduled jobs, use that time, otherwise use start of next working day
    IF latest_end_time IS NOT NULL THEN
      -- Update the queue end time for the date of the latest job
      PERFORM public.update_stage_queue_end_time(
        stage_record.production_stage_id,
        latest_end_time,
        latest_end_time::date
      );
    ELSE
      -- No scheduled jobs, set to start of today
      working_day_start := (CURRENT_DATE::timestamp + interval '8 hours');
      PERFORM public.update_stage_queue_end_time(
        stage_record.production_stage_id,
        working_day_start,
        CURRENT_DATE
      );
    END IF;
  END LOOP;
END;
$$;