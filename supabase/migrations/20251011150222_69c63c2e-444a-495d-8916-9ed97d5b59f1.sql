-- Step 1: Fix existing data - Set duration for D426339 Handwork stage
UPDATE job_stage_instances jsi
SET 
  estimated_duration_minutes = 120,
  updated_at = now()
FROM production_jobs pj
WHERE jsi.job_id = pj.id
  AND pj.wo_no = 'D426339'
  AND jsi.production_stage_id = (SELECT id FROM production_stages WHERE name = 'Handwork')
  AND (jsi.estimated_duration_minutes IS NULL OR jsi.estimated_duration_minutes = 0);

-- Step 2: Create trigger to prevent NULL/zero durations for schedulable stages
CREATE OR REPLACE FUNCTION public.enforce_stage_duration_before_scheduling()
RETURNS TRIGGER AS $$
DECLARE
  v_stage_timing record;
  v_calculated_duration integer;
BEGIN
  -- Only enforce for pending/active stages that will be scheduled
  IF NEW.status IN ('pending', 'active') AND NEW.schedule_status != 'expired' THEN
    -- If duration is NULL or 0, calculate it
    IF COALESCE(NEW.estimated_duration_minutes, 0) = 0 THEN
      
      -- Get timing from production_stages
      SELECT 
        running_speed_per_hour,
        make_ready_time_minutes,
        speed_unit
      INTO v_stage_timing
      FROM production_stages
      WHERE id = NEW.production_stage_id;
      
      -- Calculate duration if we have timing data and quantity
      IF v_stage_timing.running_speed_per_hour IS NOT NULL 
         AND v_stage_timing.running_speed_per_hour > 0 
         AND COALESCE(NEW.quantity, 0) > 0 THEN
        
        BEGIN
          SELECT * INTO v_calculated_duration
          FROM calculate_stage_timing(
            NEW.quantity,
            v_stage_timing.running_speed_per_hour,
            COALESCE(v_stage_timing.make_ready_time_minutes, 10),
            COALESCE(v_stage_timing.speed_unit, 'sheets_per_hour')
          );
          
          NEW.estimated_duration_minutes := v_calculated_duration;
          RAISE NOTICE 'Trigger auto-calculated duration: % mins for stage %', v_calculated_duration, NEW.production_stage_id;
        EXCEPTION WHEN OTHERS THEN
          -- Fallback to 60 minutes
          NEW.estimated_duration_minutes := 60;
          RAISE NOTICE 'Trigger fallback: 60 mins for stage %', NEW.production_stage_id;
        END;
      ELSE
        -- No timing data, use 60min default
        NEW.estimated_duration_minutes := 60;
        RAISE NOTICE 'Trigger default: 60 mins for stage % (no timing config)', NEW.production_stage_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to job_stage_instances
DROP TRIGGER IF EXISTS trg_enforce_stage_duration ON job_stage_instances;
CREATE TRIGGER trg_enforce_stage_duration
  BEFORE INSERT OR UPDATE ON job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_stage_duration_before_scheduling();