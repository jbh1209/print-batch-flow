-- Fix data integrity issues before implementing parallel scheduling

-- First, let's identify and fix duplicate stage entries
WITH duplicate_stages AS (
  SELECT 
    job_id,
    stage_order,
    COALESCE(part_assignment, '') as part_key,
    COUNT(*) as duplicate_count,
    array_agg(id) as duplicate_ids
  FROM job_stage_instances 
  WHERE job_table_name = 'production_jobs'
  GROUP BY job_id, stage_order, COALESCE(part_assignment, '')
  HAVING COUNT(*) > 1
),
stages_to_keep AS (
  -- Keep the first stage instance, mark others for deletion
  SELECT 
    job_id,
    stage_order,
    part_key,
    duplicate_ids[1] as keep_id,
    duplicate_ids[2:] as delete_ids
  FROM duplicate_stages
)
-- Delete duplicate stage instances (keep the first one)
DELETE FROM job_stage_instances 
WHERE id IN (
  SELECT unnest(delete_ids) 
  FROM stages_to_keep
);

-- Clean up any orphaned stage time slots
DELETE FROM stage_time_slots 
WHERE stage_instance_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM job_stage_instances 
    WHERE job_stage_instances.id = stage_time_slots.stage_instance_id
  );

-- Now let's audit what we have
CREATE OR REPLACE FUNCTION audit_job_stage_ordering()
RETURNS TABLE(
  job_id uuid,
  wo_no text,
  stage_orders integer[],
  has_duplicates boolean,
  has_gaps boolean,
  part_assignments text[],
  dependency_groups uuid[]
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jsi.job_id,
    pj.wo_no,
    array_agg(jsi.stage_order ORDER BY jsi.stage_order) as stage_orders,
    COUNT(jsi.stage_order) != COUNT(DISTINCT jsi.stage_order) as has_duplicates,
    (MAX(jsi.stage_order) - MIN(jsi.stage_order) + 1) != COUNT(jsi.stage_order) as has_gaps,
    array_agg(DISTINCT jsi.part_assignment) FILTER (WHERE jsi.part_assignment IS NOT NULL) as part_assignments,
    array_agg(DISTINCT jsi.dependency_group) FILTER (WHERE jsi.dependency_group IS NOT NULL) as dependency_groups
  FROM job_stage_instances jsi
  JOIN production_jobs pj ON pj.id = jsi.job_id
  WHERE jsi.job_table_name = 'production_jobs'
  GROUP BY jsi.job_id, pj.wo_no
  ORDER BY pj.wo_no;
END;
$$;

-- Function to fix job stage ordering while preserving parallel processing logic
CREATE OR REPLACE FUNCTION fix_job_stage_ordering()
RETURNS TABLE(jobs_fixed integer, stages_updated integer) LANGUAGE plpgsql AS $$
DECLARE
  job_record RECORD;
  stage_record RECORD;
  current_order integer;
  stages_count integer := 0;
  jobs_count integer := 0;
BEGIN
  -- Loop through each job that needs fixing
  FOR job_record IN 
    SELECT DISTINCT jsi.job_id, pj.wo_no
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.job_table_name = 'production_jobs'
  LOOP
    current_order := 1;
    jobs_count := jobs_count + 1;
    
    -- Get stages grouped by their logical order, handling parallel stages
    FOR stage_record IN
      SELECT 
        stage_order,
        array_agg(id ORDER BY id) as stage_ids,
        array_agg(DISTINCT part_assignment) FILTER (WHERE part_assignment IS NOT NULL) as parts,
        COUNT(*) as stage_count
      FROM job_stage_instances
      WHERE job_id = job_record.job_id AND job_table_name = 'production_jobs'
      GROUP BY stage_order
      ORDER BY stage_order
    LOOP
      -- Update all stages in this logical group to have the same sequential order
      UPDATE job_stage_instances
      SET stage_order = current_order
      WHERE id = ANY(stage_record.stage_ids);
      
      stages_count := stages_count + stage_record.stage_count;
      current_order := current_order + 1;
    END LOOP;
    
    -- RAISE NOTICE 'Fixed job % (WO: %) - renumbered stages', job_record.job_id, job_record.wo_no;
  END LOOP;
  
  RETURN QUERY SELECT jobs_count, stages_count;
END;
$$;

-- Run the fix
SELECT fix_job_stage_ordering();

-- Now create the unique constraint (should work now that duplicates are removed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_stage_unique_order_per_part
ON job_stage_instances(job_id, stage_order, COALESCE(part_assignment, ''))
WHERE job_table_name = 'production_jobs';