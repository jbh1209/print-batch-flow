-- STEP 3: Unified Schema Migration (Handle past validation)
-- Temporarily disable past time validation to migrate existing data

-- Check if validation trigger exists and drop it temporarily
DROP TRIGGER IF EXISTS validate_job_stage_scheduled_times_trigger ON job_stage_instances;

-- Add new columns  
ALTER TABLE job_stage_instances 
ADD COLUMN IF NOT EXISTS scheduling_method TEXT CHECK (scheduling_method IN ('manual', 'auto')) DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS scheduled_by_user_id UUID;

-- Migrate existing auto_scheduled data to scheduled columns
UPDATE job_stage_instances 
SET 
  scheduled_start_at = auto_scheduled_start_at,
  scheduled_end_at = auto_scheduled_end_at,
  scheduled_minutes = auto_scheduled_duration_minutes,
  scheduling_method = 'auto'
WHERE 
  auto_scheduled_start_at IS NOT NULL 
  AND scheduled_start_at IS NULL;

-- Drop the old auto_scheduled columns
ALTER TABLE job_stage_instances 
DROP COLUMN IF EXISTS auto_scheduled_start_at,
DROP COLUMN IF EXISTS auto_scheduled_end_at, 
DROP COLUMN IF EXISTS auto_scheduled_duration_minutes;

-- Recreate the validation trigger for future inserts/updates
CREATE OR REPLACE FUNCTION validate_job_stage_scheduled_times()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scheduled_start_at IS NOT NULL AND NEW.scheduled_start_at < now() THEN
    RAISE EXCEPTION 'Cannot schedule job stage in the past. Scheduled start: % is before current time: %', NEW.scheduled_start_at, now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_job_stage_scheduled_times_trigger
  BEFORE INSERT OR UPDATE ON job_stage_instances
  FOR EACH ROW
  WHEN (NEW.scheduled_start_at IS NOT NULL)
  EXECUTE FUNCTION validate_job_stage_scheduled_times();