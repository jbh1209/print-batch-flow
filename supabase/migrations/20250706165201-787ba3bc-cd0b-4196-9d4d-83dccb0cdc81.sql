-- Complete Stage Order Cleanup - Fix Remaining High Offset Values
-- Problem: Stage orders still using temporary high values (10000+) instead of sequential (1,2,3...)

-- Fix all categories with high offset stage orders by resetting to sequential order
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
  WHERE cps.stage_order > 100  -- Fix any stage orders that are abnormally high
)
UPDATE public.category_production_stages cps
SET 
  stage_order = csr.new_stage_order,
  updated_at = now()
FROM category_stage_reorder csr
WHERE cps.id = csr.id;