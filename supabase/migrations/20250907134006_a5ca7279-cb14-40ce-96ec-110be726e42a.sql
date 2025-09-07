-- EMERGENCY FIX: Enforce business hours in scheduler and clean up violations

-- Step 1: Clear all invalid time slots (outside business hours)
DELETE FROM public.stage_time_slots 
WHERE slot_end_time > (date_trunc('day', slot_end_time) + interval '16 hours 30 minutes')
   OR slot_start_time < (date_trunc('day', slot_start_time) + interval '8 hours');

-- Step 2: Reset schedule status for stages that had invalid slots
UPDATE public.job_stage_instances 
SET 
  schedule_status = 'unscheduled',
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = NULL,
  updated_at = now()
WHERE id NOT IN (
  SELECT DISTINCT COALESCE(stage_instance_id, '00000000-0000-0000-0000-000000000000'::uuid)
  FROM public.stage_time_slots 
  WHERE stage_instance_id IS NOT NULL
);

-- Step 3: Create business hours compliant time slot placement function
CREATE OR REPLACE FUNCTION public.place_duration_business_hours(
  p_start_time timestamptz,
  p_duration_minutes integer,
  p_production_stage_id uuid DEFAULT NULL
) RETURNS TABLE(
  slot_start_time timestamptz,
  slot_end_time timestamptz,
  duration_minutes integer
) 
LANGUAGE plpgsql
AS $$
DECLARE
  cursor_time timestamptz;
  remaining_minutes integer;
  day_start timestamptz;
  day_end timestamptz;
  lunch_start timestamptz;
  lunch_end timestamptz;
  available_minutes integer;
  slot_minutes integer;
  working_start time := '08:00:00';
  working_end time := '16:30:00';
  lunch_start_time time := '12:00:00';
  lunch_duration integer := 30;
BEGIN
  cursor_time := p_start_time;
  remaining_minutes := p_duration_minutes;
  
  -- Safety check: ensure we don't run forever
  FOR day_counter IN 1..30 LOOP
    EXIT WHEN remaining_minutes <= 0;
    
    -- Calculate day boundaries
    day_start := date_trunc('day', cursor_time) + working_start::interval;
    day_end := date_trunc('day', cursor_time) + working_end::interval;
    lunch_start := date_trunc('day', cursor_time) + lunch_start_time::interval;
    lunch_end := lunch_start + (lunch_duration || ' minutes')::interval;
    
    -- Skip weekends
    IF EXTRACT(dow FROM cursor_time) IN (0, 6) THEN
      cursor_time := date_trunc('day', cursor_time + interval '1 day') + working_start::interval;
      CONTINUE;
    END IF;
    
    -- Skip holidays
    IF EXISTS (SELECT 1 FROM public_holidays WHERE date = cursor_time::date AND COALESCE(is_active, true)) THEN
      cursor_time := date_trunc('day', cursor_time + interval '1 day') + working_start::interval;
      CONTINUE;
    END IF;
    
    -- Adjust cursor_time to start of working day if before hours
    IF cursor_time < day_start THEN
      cursor_time := day_start;
    END IF;
    
    -- Skip to next day if after working hours
    IF cursor_time >= day_end THEN
      cursor_time := date_trunc('day', cursor_time + interval '1 day') + working_start::interval;
      CONTINUE;
    END IF;
    
    -- Handle morning slot (before lunch)
    IF cursor_time < lunch_start THEN
      available_minutes := EXTRACT(epoch FROM (lunch_start - cursor_time)) / 60;
      slot_minutes := LEAST(available_minutes, remaining_minutes);
      
      -- CRITICAL: Ensure slot doesn't exceed lunch time
      IF slot_minutes > 0 AND (cursor_time + (slot_minutes || ' minutes')::interval) <= lunch_start THEN
        RETURN QUERY SELECT cursor_time, cursor_time + (slot_minutes || ' minutes')::interval, slot_minutes;
        remaining_minutes := remaining_minutes - slot_minutes;
        cursor_time := cursor_time + (slot_minutes || ' minutes')::interval;
      END IF;
      
      -- Move to after lunch if we're at lunch time
      IF cursor_time >= lunch_start THEN
        cursor_time := lunch_end;
      END IF;
    END IF;
    
    -- Handle afternoon slot (after lunch)
    IF cursor_time >= lunch_end AND cursor_time < day_end AND remaining_minutes > 0 THEN
      available_minutes := EXTRACT(epoch FROM (day_end - cursor_time)) / 60;
      slot_minutes := LEAST(available_minutes, remaining_minutes);
      
      -- CRITICAL: Ensure slot doesn't exceed working day end
      IF slot_minutes > 0 AND (cursor_time + (slot_minutes || ' minutes')::interval) <= day_end THEN
        RETURN QUERY SELECT cursor_time, cursor_time + (slot_minutes || ' minutes')::interval, slot_minutes;
        remaining_minutes := remaining_minutes - slot_minutes;
        cursor_time := cursor_time + (slot_minutes || ' minutes')::interval;
      END IF;
    END IF;
    
    -- Move to next working day
    cursor_time := date_trunc('day', cursor_time + interval '1 day') + working_start::interval;
  END LOOP;
  
  -- Safety warning if we couldn't place all time
  IF remaining_minutes > 0 THEN
    RAISE WARNING 'Could not place % remaining minutes within business hours for stage %', remaining_minutes, p_production_stage_id;
  END IF;
END;
$$;

-- Step 4: Create validation function to prevent future violations
CREATE OR REPLACE FUNCTION public.validate_time_slot_business_hours()
RETURNS TRIGGER AS $$
DECLARE
  day_start timestamptz;
  day_end timestamptz;
  lunch_start timestamptz;
  lunch_end timestamptz;
BEGIN
  -- Calculate business hours for the slot day
  day_start := date_trunc('day', NEW.slot_start_time) + '08:00:00'::time;
  day_end := date_trunc('day', NEW.slot_end_time) + '16:30:00'::time;
  lunch_start := date_trunc('day', NEW.slot_start_time) + '12:00:00'::time;
  lunch_end := date_trunc('day', NEW.slot_start_time) + '12:30:00'::time;
  
  -- Reject slots outside business hours
  IF NEW.slot_start_time < day_start OR NEW.slot_end_time > day_end THEN
    RAISE EXCEPTION 'Time slot (% to %) violates business hours (08:00-16:30)', 
      NEW.slot_start_time, NEW.slot_end_time;
  END IF;
  
  -- Reject slots during lunch break (12:00-12:30)
  IF (NEW.slot_start_time < lunch_end AND NEW.slot_end_time > lunch_start) THEN
    RAISE EXCEPTION 'Time slot (% to %) overlaps with lunch break (12:00-12:30)', 
      NEW.slot_start_time, NEW.slot_end_time;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add trigger to enforce business hours validation
DROP TRIGGER IF EXISTS enforce_business_hours_trigger ON public.stage_time_slots;
CREATE TRIGGER enforce_business_hours_trigger
  BEFORE INSERT OR UPDATE ON public.stage_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_time_slot_business_hours();