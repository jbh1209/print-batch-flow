
-- First, let's check the current unique constraints on job_stage_instances
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'job_stage_instances'::regclass 
AND contype = 'u';

-- Drop the existing unique constraint that's causing conflicts
-- (This constraint likely exists on job_id, job_table_name, production_stage_id)
DROP INDEX IF EXISTS job_stage_instances_job_id_job_table_name_production_stage_idx;
DROP INDEX IF EXISTS idx_job_stage_instances_unique;

-- Create a new unique constraint that includes part_name to allow multiple parts per stage
CREATE UNIQUE INDEX idx_job_stage_instances_unique_with_parts 
ON job_stage_instances (job_id, job_table_name, production_stage_id, COALESCE(part_name, ''));

-- Also ensure we have a partial unique index for single-part stages (where part_name is NULL)
CREATE UNIQUE INDEX idx_job_stage_instances_unique_single_part 
ON job_stage_instances (job_id, job_table_name, production_stage_id) 
WHERE part_name IS NULL;
