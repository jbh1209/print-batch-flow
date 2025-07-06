-- Fix Ambiguous Part Names - Make Printing vs Laminating Parts Clear
-- Problem: Both printing and laminating stages use generic "covers" names

-- 1. Update printing stages to use "print_covers" instead of "covers"
UPDATE public.production_stages 
SET part_definitions = CASE 
  WHEN part_definitions::text LIKE '%"covers"%' THEN 
    replace(part_definitions::text, '"covers"', '"print_covers"')::jsonb
  WHEN part_definitions::text LIKE '%"Covers"%' THEN 
    replace(part_definitions::text, '"Covers"', '"print_covers"')::jsonb
  ELSE part_definitions
END,
updated_at = now()
WHERE name ILIKE '%print%' 
  AND is_multi_part = true
  AND (part_definitions::text LIKE '%"covers"%' OR part_definitions::text LIKE '%"Covers"%');

-- 2. Update laminating stages to use "lam_covers" instead of "covers"  
UPDATE public.production_stages 
SET part_definitions = CASE 
  WHEN part_definitions::text LIKE '%"covers"%' THEN 
    replace(part_definitions::text, '"covers"', '"lam_covers"')::jsonb
  WHEN part_definitions::text LIKE '%"Covers"%' THEN 
    replace(part_definitions::text, '"Covers"', '"lam_covers"')::jsonb
  ELSE part_definitions
END,
updated_at = now()
WHERE name ILIKE '%lam%' 
  AND is_multi_part = true
  AND (part_definitions::text LIKE '%"covers"%' OR part_definitions::text LIKE '%"Covers"%');

-- 3. Update existing job_stage_instances to match new naming
UPDATE public.job_stage_instances jsi
SET part_name = 'print_covers',
    updated_at = now()
FROM public.production_stages ps
WHERE jsi.production_stage_id = ps.id
  AND ps.name ILIKE '%print%'
  AND jsi.part_name IN ('covers', 'Covers');

UPDATE public.job_stage_instances jsi  
SET part_name = 'lam_covers',
    updated_at = now()
FROM public.production_stages ps
WHERE jsi.production_stage_id = ps.id
  AND ps.name ILIKE '%lam%'
  AND jsi.part_name IN ('covers', 'Covers');

-- 4. Also update category_production_stages part_mapping if it exists
UPDATE public.category_production_stages cps
SET part_mapping = CASE 
  WHEN part_mapping::text LIKE '%"covers"%' AND EXISTS (
    SELECT 1 FROM public.production_stages ps 
    WHERE ps.id = cps.production_stage_id AND ps.name ILIKE '%print%'
  ) THEN 
    replace(part_mapping::text, '"covers"', '"print_covers"')::jsonb
  WHEN part_mapping::text LIKE '%"covers"%' AND EXISTS (
    SELECT 1 FROM public.production_stages ps 
    WHERE ps.id = cps.production_stage_id AND ps.name ILIKE '%lam%'
  ) THEN 
    replace(part_mapping::text, '"covers"', '"lam_covers"')::jsonb
  ELSE part_mapping
END,
updated_at = now()
WHERE part_mapping IS NOT NULL
  AND part_mapping::text LIKE '%"covers"%';