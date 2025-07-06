-- Fix Corrupted Category Stage Orders with Proper Business Logic
-- Problem: Negative stage orders from failed reordering + business rule validation

-- 1. Temporarily disable the validation trigger
DROP TRIGGER IF EXISTS validate_stage_order_trigger ON category_production_stages;

-- 2. Fix the corrupted Perfect Bounds Books category with correct business logic
-- Batch Allocation must be first, then other stages in logical order
UPDATE public.category_production_stages 
SET stage_order = CASE 
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name = 'Batch Allocation') THEN 1
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name = 'DTP') THEN 2
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name = 'PROOF') THEN 3
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name ILIKE '%print%' AND name ILIKE '%t250%') THEN 4
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name ILIKE '%print%' AND name ILIKE '%12000%') THEN 5
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name = 'UV Varnishing') THEN 6
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name = 'Gathering') THEN 7
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name = 'Perfect Binding') THEN 8
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name = 'Final Trimming') THEN 9
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name = 'Packaging') THEN 10
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name = 'Shipped') THEN 11
  WHEN production_stage_id IN (SELECT id FROM production_stages WHERE name = 'Completed') THEN 12
  ELSE stage_order
END,
updated_at = now()
WHERE category_id IN (
  SELECT id FROM public.categories 
  WHERE name LIKE '%Perfect Bounds Books + UV Varn%'
);

-- 3. Fix any other categories with negative stage orders
WITH ordered_stages AS (
  SELECT 
    cps.id,
    cps.category_id,
    ps.name,
    ROW_NUMBER() OVER (
      PARTITION BY cps.category_id 
      ORDER BY 
        CASE WHEN ps.name = 'Batch Allocation' THEN 1 ELSE 2 END,
        cps.stage_order
    ) as new_order
  FROM public.category_production_stages cps
  JOIN public.production_stages ps ON cps.production_stage_id = ps.id
  WHERE cps.stage_order < 0
)
UPDATE public.category_production_stages cps
SET stage_order = os.new_order,
    updated_at = now()
FROM ordered_stages os
WHERE cps.id = os.id;

-- 4. Re-enable the validation trigger
CREATE TRIGGER validate_stage_order_trigger
  BEFORE INSERT OR UPDATE ON category_production_stages
  FOR EACH ROW
  EXECUTE FUNCTION validate_stage_order_integrity();