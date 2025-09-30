-- Add original_committed_due_date column to production_jobs table
-- This stores the initial committed due date when the job is approved
-- It never changes after being set, used to track schedule delays

ALTER TABLE production_jobs 
ADD COLUMN IF NOT EXISTS original_committed_due_date date;