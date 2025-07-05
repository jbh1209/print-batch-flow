-- COMPREHENSIVE FIX: Stage Order Corruption and Job Progression Issues
-- Problem: Jobs D425114 and D425127 have BOTH Batch Allocation and Printing at stage_order = 3
-- This causes workflow confusion and prevents proper advancement

-- Step 1: Fix the fundamental stage order issue by creating proper gaps
-- We need to ensure NO conflicts exist anywhere

-- First, find and fix categories where Printing has stage_order = 3 (should be 4+)
-- Move all Printing stages that are at stage_order = 3 to a higher order

-- Get the max stage order for each category to avoid conflicts
WITH category_max_orders AS (
  SELECT 
    category_id,
    MAX(stage_order) as max_order
  FROM category_production_stages cps
  JOIN production_stages ps ON cps.production_stage_id = ps.id
  WHERE ps.name NOT ILIKE '%print%'  -- Exclude printing stages from max calculation
  GROUP BY category_id
),
printing_stages_at_3 AS (
  SELECT 
    cps.id,
    cps.category_id,
    cps.production_stage_id,
    cps.stage_order,
    cmo.max_order
  FROM category_production_stages cps
  JOIN production_stages ps ON cps.production_stage_id = ps.id
  JOIN category_max_orders cmo ON cps.category_id = cmo.category_id
  WHERE ps.name ILIKE '%print%' 
    AND cps.stage_order = 3
)
UPDATE category_production_stages 
SET stage_order = GREATEST(4, max_order + 1), updated_at = now()
FROM printing_stages_at_3 p3
WHERE category_production_stages.id = p3.id;

-- Step 2: Fix job stage instances that have incorrect ordering
-- Update all job stage instances for printing stages that were at order 3
UPDATE job_stage_instances jsi
SET stage_order = (
  SELECT cps.stage_order 
  FROM category_production_stages cps 
  WHERE cps.category_id = jsi.category_id 
    AND cps.production_stage_id = jsi.production_stage_id
), updated_at = now()
FROM production_stages ps
WHERE jsi.production_stage_id = ps.id
  AND ps.name ILIKE '%print%'
  AND jsi.stage_order = 3;

-- Step 3: Fix the specific jobs mentioned (D425114, D425127) that are stuck
-- These should be activated in Batch Allocation stage and marked as batch_ready
UPDATE job_stage_instances
SET 
  status = 'active',
  started_at = now(),
  started_by = (SELECT id FROM auth.users LIMIT 1),
  updated_at = now()
WHERE job_id IN (
  SELECT id FROM production_jobs WHERE wo_no IN ('D425114', 'D425127')
) 
AND production_stage_id = (SELECT id FROM production_stages WHERE name = 'Batch Allocation')
AND status = 'pending';

-- Step 4: Mark these jobs as ready for batching
UPDATE production_jobs
SET 
  batch_ready = true,
  batch_allocated_at = now(),
  batch_allocated_by = (SELECT id FROM auth.users LIMIT 1),
  updated_at = now()
WHERE wo_no IN ('D425114', 'D425127');