-- PHASE 1: Fix the stage order corruption
-- The core issue is that Batch Allocation (stage_order = 3) and some Printing stages (also stage_order = 3) 
-- are conflicting. Batch Allocation should always come BEFORE Printing.

-- First, let's fix the stage orders to ensure proper sequencing:
-- Batch Allocation should be stage_order = 3
-- All Printing stages should be stage_order = 4 or higher

UPDATE public.category_production_stages 
SET stage_order = 4, updated_at = now()
WHERE production_stage_id IN (
  SELECT ps.id 
  FROM public.production_stages ps
  WHERE ps.name ILIKE '%print%'
) 
AND stage_order = 3;

-- Now fix any existing job stage instances that have incorrect ordering
UPDATE public.job_stage_instances jsi
SET stage_order = 4, updated_at = now()
FROM public.production_stages ps
WHERE jsi.production_stage_id = ps.id
  AND ps.name ILIKE '%print%'
  AND jsi.stage_order = 3;

-- Verify Batch Allocation is consistently at stage_order = 3
UPDATE public.category_production_stages 
SET stage_order = 3, updated_at = now()
WHERE production_stage_id = (
  SELECT id FROM public.production_stages WHERE name = 'Batch Allocation'
)
AND stage_order != 3;

-- Update any job stage instances for Batch Allocation to use stage_order = 3
UPDATE public.job_stage_instances jsi
SET stage_order = 3, updated_at = now()
FROM public.production_stages ps
WHERE jsi.production_stage_id = ps.id
  AND ps.name = 'Batch Allocation'
  AND jsi.stage_order != 3;