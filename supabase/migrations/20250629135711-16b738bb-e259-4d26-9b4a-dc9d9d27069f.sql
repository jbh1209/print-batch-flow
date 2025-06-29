
-- Update flyer_jobs table to use text fields instead of enums for dynamic specifications
ALTER TABLE public.flyer_jobs 
ALTER COLUMN size TYPE text,
ALTER COLUMN paper_type TYPE text;

-- Drop the old enum types if they exist (they may be referenced by the table)
DROP TYPE IF EXISTS flyer_size CASCADE;
DROP TYPE IF EXISTS flyer_paper_type CASCADE;

-- Also update the status column to use text instead of enum for consistency
ALTER TABLE public.flyer_jobs 
ALTER COLUMN status TYPE text;

-- Drop the job_status enum if it's no longer needed
DROP TYPE IF EXISTS job_status CASCADE;
