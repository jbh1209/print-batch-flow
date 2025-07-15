-- Drop the existing constraint that prevents multiple instances of the same production stage
ALTER TABLE job_stage_instances 
DROP CONSTRAINT IF EXISTS job_stage_instances_job_id_job_table_name_production_stage__key;

-- Also drop any related indexes that might be causing the issue
DROP INDEX IF EXISTS job_stage_instances_job_id_job_table_name_production_stage_idx;
DROP INDEX IF EXISTS idx_job_stage_instances_unique_with_parts;
DROP INDEX IF EXISTS idx_job_stage_instances_unique_single_part;

-- Create a new unique constraint that allows multiple instances with different specifications
-- This allows the same production stage to appear multiple times for the same job
-- as long as they have different specifications, part names, or notes
CREATE UNIQUE INDEX idx_job_stage_instances_unique_detailed
ON job_stage_instances (
  job_id, 
  job_table_name, 
  production_stage_id, 
  COALESCE(stage_specification_id::text, ''), 
  COALESCE(part_name, ''), 
  COALESCE(notes, '')
);

-- Create a partial unique index for cases where all the optional fields are NULL
-- This ensures basic uniqueness for simple workflows
CREATE UNIQUE INDEX idx_job_stage_instances_unique_simple
ON job_stage_instances (job_id, job_table_name, production_stage_id)
WHERE stage_specification_id IS NULL AND part_name IS NULL AND notes IS NULL;