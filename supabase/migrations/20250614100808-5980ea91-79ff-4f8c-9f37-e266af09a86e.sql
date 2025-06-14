
-- Drop potentially existing unique indexes to ensure a clean state.
-- Order of dropping might matter if one depends on another, but generally, these should be independent.

-- Drop the partial unique index for single-part stages (where part_name is NULL)
DROP INDEX IF EXISTS public.idx_job_stage_instances_unique_single_part;

-- Drop the unique constraint that includes part_name (COALESCE version)
DROP INDEX IF EXISTS public.idx_job_stage_instances_unique_with_parts;

-- Drop older or generic unique constraints if they exist
DROP INDEX IF EXISTS public.job_stage_instances_job_id_job_table_name_production_stage_idx;
DROP INDEX IF EXISTS public.idx_job_stage_instances_unique;
DROP INDEX IF EXISTS public.job_stage_instances_job_id_job_table_name_production_stage_id_part_name_key; -- A common naming convention for unique constraints

-- Now, recreate the intended unique indexes:

-- 1. Create a unique constraint that includes part_name, treating NULL part_name as an empty string for uniqueness.
-- This allows a stage to appear once with a NULL (empty string effective) part_name,
-- and then again for each unique actual part_name.
CREATE UNIQUE INDEX idx_job_stage_instances_unique_with_parts
ON public.job_stage_instances (job_id, job_table_name, production_stage_id, COALESCE(part_name, ''));

-- 2. Create a partial unique index specifically for single-part stages (where part_name is NULL).
-- This ensures that for any given job, table, and production_stage_id, there's at most one instance
-- where part_name is explicitly NULL.
CREATE UNIQUE INDEX idx_job_stage_instances_unique_single_part
ON public.job_stage_instances (job_id, job_table_name, production_stage_id)
WHERE part_name IS NULL;

