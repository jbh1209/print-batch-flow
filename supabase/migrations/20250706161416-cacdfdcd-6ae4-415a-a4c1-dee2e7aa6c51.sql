-- Fix Standard Printing Stages - Revert Multi-Part Setting
-- Problem: Standard printing stages were incorrectly set to multi-part, forcing part selection for single-material jobs

-- Revert standard printing stages back to single-part
UPDATE public.production_stages 
SET is_multi_part = false,
    part_definitions = '[]'::jsonb,
    updated_at = now()
WHERE name ILIKE '%standard%'
  AND name ILIKE '%print%'
  AND name ILIKE '%queue%';

-- Also revert any other single-material printing stages that don't need part separation
UPDATE public.production_stages 
SET is_multi_part = false,
    part_definitions = '[]'::jsonb,
    updated_at = now()
WHERE (name ILIKE '%hp 12000%' OR name ILIKE '%hp t250%')
  AND name ILIKE '%queue%'
  AND name NOT ILIKE '%multi%'
  AND name NOT ILIKE '%cover%'
  AND name NOT ILIKE '%text%';