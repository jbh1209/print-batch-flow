-- Assign existing production stages to appropriate stage groups
-- This should be run after the stage groups have been created

-- Update printing-related stages to be in the Printing group
UPDATE public.production_stages 
SET stage_group_id = (SELECT id FROM public.stage_groups WHERE name = 'Printing' LIMIT 1)
WHERE name ILIKE '%print%' 
   OR name ILIKE '%hp%' 
   OR name ILIKE '%digital%'
   OR name ILIKE '%litho%'
   OR name ILIKE '%press%';

-- Update finishing-related stages to be in the Finishing group  
UPDATE public.production_stages 
SET stage_group_id = (SELECT id FROM public.stage_groups WHERE name = 'Finishing' LIMIT 1)
WHERE name ILIKE '%lamination%' 
   OR name ILIKE '%laminating%'
   OR name ILIKE '%trim%'
   OR name ILIKE '%cut%'
   OR name ILIKE '%finish%'
   OR name ILIKE '%fold%'
   OR name ILIKE '%crease%'
   OR name ILIKE '%emboss%'
   OR name ILIKE '%spot%'
   OR name ILIKE '%uv%'
   OR name ILIKE '%varnish%'
   OR name ILIKE '%hunkeler%';

-- Update binding-related stages to be in the Binding group (sequential)
UPDATE public.production_stages 
SET stage_group_id = (SELECT id FROM public.stage_groups WHERE name = 'Binding' LIMIT 1)
WHERE name ILIKE '%bind%' 
   OR name ILIKE '%stitch%'
   OR name ILIKE '%gather%'
   OR name ILIKE '%perfect%'
   OR name ILIKE '%saddle%'
   OR name ILIKE '%spiral%'
   OR name ILIKE '%wire%'
   OR name ILIKE '%comb%';

-- Update quality control stages to be in the Quality Control group
UPDATE public.production_stages 
SET stage_group_id = (SELECT id FROM public.stage_groups WHERE name = 'Quality Control' LIMIT 1)
WHERE name ILIKE '%proof%' 
   OR name ILIKE '%approval%'
   OR name ILIKE '%dtp%'
   OR name ILIKE '%check%'
   OR name ILIKE '%review%'
   OR name ILIKE '%verify%';

-- Update delivery stages to be in the Delivery group
UPDATE public.production_stages 
SET stage_group_id = (SELECT id FROM public.stage_groups WHERE name = 'Delivery' LIMIT 1)
WHERE name ILIKE '%deliver%' 
   OR name ILIKE '%dispatch%'
   OR name ILIKE '%ship%'
   OR name ILIKE '%collect%'
   OR name ILIKE '%pack%';