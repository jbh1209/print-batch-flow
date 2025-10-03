-- Add partial stage completion tracking fields to job_stage_instances
ALTER TABLE job_stage_instances ADD COLUMN IF NOT EXISTS 
  completion_percentage integer DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100);

ALTER TABLE job_stage_instances ADD COLUMN IF NOT EXISTS 
  remaining_minutes integer DEFAULT 0;

ALTER TABLE job_stage_instances ADD COLUMN IF NOT EXISTS 
  hold_reason text;

ALTER TABLE job_stage_instances ADD COLUMN IF NOT EXISTS 
  held_at timestamp with time zone;

ALTER TABLE job_stage_instances ADD COLUMN IF NOT EXISTS 
  held_by uuid;

COMMENT ON COLUMN job_stage_instances.completion_percentage IS 'Percentage of stage completed when placed on hold (0-100)';
COMMENT ON COLUMN job_stage_instances.remaining_minutes IS 'Minutes remaining to complete stage after partial completion';
COMMENT ON COLUMN job_stage_instances.hold_reason IS 'Operator explanation for why stage was placed on hold';
COMMENT ON COLUMN job_stage_instances.held_at IS 'Timestamp when stage was placed on hold';
COMMENT ON COLUMN job_stage_instances.held_by IS 'User ID who placed stage on hold';