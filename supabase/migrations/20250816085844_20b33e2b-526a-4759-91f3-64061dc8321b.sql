-- STEP 3: Unified Schema Migration 
-- Migrate auto_scheduled_start_at → scheduled_start_at preserving data
-- Add scheduling_method enum and scheduled_by_user_id columns

-- First, add new columns
ALTER TABLE job_stage_instances 
ADD COLUMN IF NOT EXISTS scheduling_method TEXT CHECK (scheduling_method IN ('manual', 'auto')) DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS scheduled_by_user_id UUID REFERENCES auth.users(id);

-- Migrate existing data: auto_scheduled_start_at → scheduled_start_at  
UPDATE job_stage_instances 
SET 
  scheduled_start_at = auto_scheduled_start_at,
  scheduled_end_at = auto_scheduled_end_at, 
  scheduled_minutes = auto_scheduled_duration_minutes,
  scheduling_method = 'auto'
WHERE 
  auto_scheduled_start_at IS NOT NULL 
  AND scheduled_start_at IS NULL;

-- Drop the old auto_scheduled columns after migration
ALTER TABLE job_stage_instances 
DROP COLUMN IF EXISTS auto_scheduled_start_at,
DROP COLUMN IF EXISTS auto_scheduled_end_at,
DROP COLUMN IF EXISTS auto_scheduled_duration_minutes;