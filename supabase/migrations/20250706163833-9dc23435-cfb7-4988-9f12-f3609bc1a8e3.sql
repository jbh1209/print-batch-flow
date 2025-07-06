-- Fix Corrupted Category Stage Orders
-- Problem: Category stages have negative stage_order values from failed reordering operations

-- 1. Fix the specific corrupted category first
UPDATE public.category_production_stages 
SET stage_order = CASE 
  WHEN stage_order = -1 THEN 1
  WHEN stage_order = -2 THEN 2
  WHEN stage_order = -3 THEN 3
  WHEN stage_order = -4 THEN 4
  WHEN stage_order = -5 THEN 5
  WHEN stage_order = -6 THEN 6
  WHEN stage_order = -7 THEN 7
  WHEN stage_order = -8 THEN 8
  WHEN stage_order = -9 THEN 9
  WHEN stage_order = -10 THEN 10
  WHEN stage_order = -11 THEN 11
  WHEN stage_order = 12 THEN 12
  ELSE stage_order
END,
updated_at = now()
WHERE category_id IN (
  SELECT id FROM public.categories 
  WHERE name LIKE '%Perfect Bounds Books + UV Varn%'
)
AND stage_order BETWEEN -11 AND 12;

-- 2. Fix any other categories with negative stage orders globally
WITH fixed_orders AS (
  SELECT 
    id,
    category_id,
    ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY stage_order) as new_order
  FROM public.category_production_stages
  WHERE stage_order < 0
)
UPDATE public.category_production_stages cps
SET stage_order = fo.new_order,
    updated_at = now()
FROM fixed_orders fo
WHERE cps.id = fo.id;