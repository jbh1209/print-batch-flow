-- Fix duplicate stage orders and missing capacity profiles

-- First, add missing capacity profiles for printing stages
INSERT INTO stage_capacity_profiles (
  production_stage_id,
  daily_capacity_hours,
  efficiency_factor,
  setup_time_minutes
)
SELECT 
  ps.id,
  8, -- 8 hour workday
  0.85, -- 85% efficiency
  30 -- 30 minutes setup
FROM production_stages ps
LEFT JOIN stage_capacity_profiles scp ON ps.id = scp.production_stage_id
WHERE ps.name LIKE 'Printing%' 
  AND scp.id IS NULL
  AND ps.is_active = true;

-- Update job stage instances to fix duplicate stage orders
-- When multiple stages exist at same order, give them sequential orders
WITH duplicates AS (
  SELECT 
    jsi.id,
    jsi.job_id,
    jsi.stage_order as original_order,
    ps.name,
    ROW_NUMBER() OVER (
      PARTITION BY jsi.job_id, jsi.stage_order 
      ORDER BY ps.name, jsi.created_at
    ) as rn
  FROM job_stage_instances jsi
  JOIN production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_table_name = 'production_jobs'
),
stage_conflicts AS (
  SELECT job_id, original_order
  FROM duplicates
  GROUP BY job_id, original_order
  HAVING COUNT(*) > 1
)
UPDATE job_stage_instances 
SET stage_order = d.original_order + (d.rn - 1) * 0.1,
    updated_at = now()
FROM duplicates d
WHERE job_stage_instances.id = d.id
  AND d.rn > 1
  AND EXISTS (
    SELECT 1 FROM stage_conflicts sc 
    WHERE sc.job_id = d.job_id 
    AND sc.original_order = d.original_order
  );