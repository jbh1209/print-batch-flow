-- **PHASE 2: BUSINESS LOGIC ENGINE - DATABASE CONSTRAINTS**
-- Add database-level validation to prevent invalid scheduling data

-- Create business hours validation function
CREATE OR REPLACE FUNCTION public.validate_business_hours(check_time timestamptz)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 
    EXTRACT(hour FROM check_time AT TIME ZONE 'Africa/Johannesburg') >= 8 
    AND 
    (EXTRACT(hour FROM check_time AT TIME ZONE 'Africa/Johannesburg') < 17 
     OR (EXTRACT(hour FROM check_time AT TIME ZONE 'Africa/Johannesburg') = 17 
         AND EXTRACT(minute FROM check_time AT TIME ZONE 'Africa/Johannesburg') <= 30))
$$;

-- Create working day validation function  
CREATE OR REPLACE FUNCTION public.validate_working_day(check_time timestamptz)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXTRACT(dow FROM check_time AT TIME ZONE 'Africa/Johannesburg') BETWEEN 1 AND 5
$$;

-- Create past time validation function
CREATE OR REPLACE FUNCTION public.validate_not_in_past(check_time timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT check_time >= now()
$$;

-- Add validation trigger for stage_time_slots
CREATE OR REPLACE FUNCTION public.validate_stage_time_slot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate start time is not in past
  IF NOT validate_not_in_past(NEW.slot_start_time) THEN
    RAISE EXCEPTION 'Cannot schedule stage time slot in the past. Start time: % is before current time: %', 
      NEW.slot_start_time AT TIME ZONE 'Africa/Johannesburg', 
      now() AT TIME ZONE 'Africa/Johannesburg';
  END IF;
  
  -- Validate start time is within business hours
  IF NOT validate_business_hours(NEW.slot_start_time) THEN
    RAISE EXCEPTION 'Stage time slot start time % is outside business hours (8:00 AM - 5:30 PM SAST)', 
      NEW.slot_start_time AT TIME ZONE 'Africa/Johannesburg';
  END IF;
  
  -- Validate start time is on working day
  IF NOT validate_working_day(NEW.slot_start_time) THEN
    RAISE EXCEPTION 'Stage time slot start time % is not on a working day (Monday-Friday)', 
      NEW.slot_start_time AT TIME ZONE 'Africa/Johannesburg';
  END IF;
  
  -- Validate end time is not before start time
  IF NEW.slot_end_time <= NEW.slot_start_time THEN
    RAISE EXCEPTION 'Stage time slot end time % must be after start time %', 
      NEW.slot_end_time AT TIME ZONE 'Africa/Johannesburg',
      NEW.slot_start_time AT TIME ZONE 'Africa/Johannesburg';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply validation trigger to stage_time_slots table
DROP TRIGGER IF EXISTS validate_stage_time_slot_trigger ON public.stage_time_slots;
CREATE TRIGGER validate_stage_time_slot_trigger
  BEFORE INSERT OR UPDATE ON public.stage_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION validate_stage_time_slot();

-- Add validation trigger for job_stage_instances scheduled times
CREATE OR REPLACE FUNCTION public.validate_job_stage_scheduled_times()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only validate if auto_scheduled_start_at is being set
  IF NEW.auto_scheduled_start_at IS NOT NULL THEN
    -- Validate scheduled start time is not in past
    IF NOT validate_not_in_past(NEW.auto_scheduled_start_at) THEN
      RAISE EXCEPTION 'Cannot schedule job stage in the past. Scheduled start: % is before current time: %', 
        NEW.auto_scheduled_start_at AT TIME ZONE 'Africa/Johannesburg', 
        now() AT TIME ZONE 'Africa/Johannesburg';
    END IF;
    
    -- Validate scheduled start time is within business hours
    IF NOT validate_business_hours(NEW.auto_scheduled_start_at) THEN
      RAISE EXCEPTION 'Job stage scheduled start time % is outside business hours (8:00 AM - 5:30 PM SAST)', 
        NEW.auto_scheduled_start_at AT TIME ZONE 'Africa/Johannesburg';
    END IF;
    
    -- Validate scheduled start time is on working day
    IF NOT validate_working_day(NEW.auto_scheduled_start_at) THEN
      RAISE EXCEPTION 'Job stage scheduled start time % is not on a working day (Monday-Friday)', 
        NEW.auto_scheduled_start_at AT TIME ZONE 'Africa/Johannesburg';
    END IF;
  END IF;
  
  -- Validate end time if set
  IF NEW.auto_scheduled_end_at IS NOT NULL AND NEW.auto_scheduled_start_at IS NOT NULL THEN
    IF NEW.auto_scheduled_end_at <= NEW.auto_scheduled_start_at THEN
      RAISE EXCEPTION 'Job stage scheduled end time % must be after start time %', 
        NEW.auto_scheduled_end_at AT TIME ZONE 'Africa/Johannesburg',
        NEW.auto_scheduled_start_at AT TIME ZONE 'Africa/Johannesburg';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply validation trigger to job_stage_instances table
DROP TRIGGER IF EXISTS validate_job_stage_scheduled_times_trigger ON public.job_stage_instances;
CREATE TRIGGER validate_job_stage_scheduled_times_trigger
  BEFORE INSERT OR UPDATE ON public.job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION validate_job_stage_scheduled_times();