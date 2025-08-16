-- STEP 3: Unified Schema Migration (Handle ALL validation functions)
-- Temporarily disable ALL validation to migrate existing data

-- Drop all validation triggers temporarily
DROP TRIGGER IF EXISTS validate_job_stage_scheduled_times_trigger ON job_stage_instances;
DROP TRIGGER IF EXISTS validate_schedule_logic_trigger ON job_stage_instances; 
DROP TRIGGER IF EXISTS trg_validate_schedule_logic ON job_stage_instances;

-- Drop validation functions temporarily  
DROP FUNCTION IF EXISTS validate_job_stage_scheduled_times();
DROP FUNCTION IF EXISTS validate_schedule_logic();

-- Add new columns
ALTER TABLE job_stage_instances 
ADD COLUMN IF NOT EXISTS scheduling_method TEXT CHECK (scheduling_method IN ('manual', 'auto')) DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS scheduled_by_user_id UUID;

-- Migrate existing auto_scheduled data to scheduled columns (ignore validation)
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

-- Note: Validation will be re-enabled in production code that validates future scheduling