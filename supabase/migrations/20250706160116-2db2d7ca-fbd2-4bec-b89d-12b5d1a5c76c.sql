-- Fix Stage Ordering - Move Printing Stages to Correct Position
-- Problem: Printing stages are at order 400, should be at 4 (after Batch Allocation, before finishing)

-- 1. Fix production_stages order_index
UPDATE public.production_stages 
SET order_index = 4
WHERE name ILIKE '%printing%' 
  AND name NOT ILIKE '%queue%'
  AND name NOT ILIKE '%laminating%';

-- 2. Move Laminating Queue to order 10 (clear gap after printing)
UPDATE public.production_stages 
SET order_index = 10
WHERE name = 'Laminating Queue';

-- 3. Move other finishing stages to start at 11+ 
UPDATE public.production_stages 
SET order_index = order_index + 8  -- Shift finishing stages higher
WHERE order_index >= 30 
  AND order_index < 400
  AND name NOT ILIKE '%printing%';

-- 4. Update job_stage_instances to match corrected stage orders
UPDATE public.job_stage_instances jsi
SET stage_order = ps.order_index
FROM public.production_stages ps
WHERE jsi.production_stage_id = ps.id
  AND jsi.stage_order != ps.order_index;