-- Add 'changes_requested' status to job_stage_instances
-- This allows external clients to request changes on proofs without automatic workflow rerouting

-- Update the column comment to document all valid statuses
COMMENT ON COLUMN job_stage_instances.status IS 'Current status of the stage: pending, active, completed, skipped, on_hold, changes_requested, reworked, awaiting_approval';