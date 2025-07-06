-- Fix High-Value Stage Orders - Targeted Approach
-- Problem: Batch Allocation is correctly at order 1, but other stages are at 10000+ values

-- For this specific category, update the high-value stages to proper sequential order
-- starting from 2 (since Batch Allocation is already at 1)
WITH stage_fixes AS (
  SELECT 
    cps.id,
    -- Start from 2 since Batch Allocation is already at 1
    ROW_NUMBER() OVER (ORDER BY cps.stage_order) + 1 as new_order
  FROM category_production_stages cps
  JOIN production_stages ps ON cps.production_stage_id = ps.id
  WHERE cps.category_id = '32d12ad4-926e-44ef-94ef-a927bcd284e6'
    AND cps.stage_order > 100  -- Only fix the high-value ones
    AND ps.name != 'Batch Allocation'  -- Exclude Batch Allocation (already correct)
)
UPDATE category_production_stages cps
SET 
  stage_order = sf.new_order,
  updated_at = now()
FROM stage_fixes sf
WHERE cps.id = sf.id;

-- Also fix any other categories that might have similar issues
WITH other_category_fixes AS (
  SELECT 
    cps.id,
    cps.category_id,
    ps.name as stage_name,
    ROW_NUMBER() OVER (
      PARTITION BY cps.category_id 
      ORDER BY 
        CASE WHEN ps.name = 'Batch Allocation' THEN 0 ELSE 1 END,
        cps.stage_order
    ) as new_stage_order
  FROM category_production_stages cps
  JOIN production_stages ps ON cps.production_stage_id = ps.id
  WHERE cps.category_id != '32d12ad4-926e-44ef-94ef-a927bcd284e6'  -- Other categories
    AND cps.stage_order > 100  -- Only high-value stage orders
)
UPDATE category_production_stages cps
SET 
  stage_order = ocf.new_stage_order,
  updated_at = now()
FROM other_category_fixes ocf
WHERE cps.id = ocf.id;