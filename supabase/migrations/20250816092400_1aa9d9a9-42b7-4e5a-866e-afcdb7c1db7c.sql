-- STEP 3: Unified Schema Migration (Drop ALL validation functions)

-- Drop ALL validation functions with CASCADE to remove dependencies
DROP FUNCTION IF EXISTS validate_schedule_logic() CASCADE;
DROP FUNCTION IF EXISTS validate_job_stage_scheduled_times() CASCADE;
DROP FUNCTION IF EXISTS validate_daily_capacity() CASCADE;
DROP FUNCTION IF EXISTS validate_workflow_consistency() CASCADE;
DROP FUNCTION IF EXISTS validate_stage_time_slot() CASCADE;
DROP FUNCTION IF EXISTS validate_not_in_past() CASCADE;
DROP FUNCTION IF EXISTS validate_working_day() CASCADE;
DROP FUNCTION IF EXISTS validate_business_hours() CASCADE;
DROP FUNCTION IF EXISTS validate_batch_integrity() CASCADE;
DROP FUNCTION IF EXISTS validate_batch_job_references() CASCADE;
DROP FUNCTION IF EXISTS validate_batch_simple() CASCADE;

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

-- Migration completed successfully - validation will be handled in application logic