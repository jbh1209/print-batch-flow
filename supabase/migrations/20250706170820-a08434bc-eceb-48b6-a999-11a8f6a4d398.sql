-- Safe Stage Order Cleanup - Handle Unique Constraint Properly
-- Problem: Can't directly update stage orders due to unique constraint (category_id, stage_order)

-- Step 1: First move all high-offset stages to safe temporary values to avoid conflicts
UPDATE public.category_production_stages 
SET stage_order = stage_order + 20000,
    updated_at = now()
WHERE stage_order > 100;

-- Step 2: Now safely update to proper sequential order
WITH category_stage_reorder AS (
  SELECT 
    cps.id,
    cps.category_id,
    ps.name as stage_name,
    -- Assign proper sequential order, ensuring Batch Allocation is always first
    ROW_NUMBER() OVER (
      PARTITION BY cps.category_id 
      ORDER BY 
        CASE WHEN ps.name = 'Batch Allocation' THEN 0 ELSE 1 END,
        cps.stage_order
    ) as new_stage_order
  FROM public.category_production_stages cps
  JOIN public.production_stages ps ON cps.production_stage_id = ps.id
  WHERE cps.stage_order > 20000  -- Target the temporarily moved stages
)
UPDATE public.category_production_stages cps
SET 
  stage_order = csr.new_stage_order,
  updated_at = now()
FROM category_stage_reorder csr
WHERE cps.id = csr.id;