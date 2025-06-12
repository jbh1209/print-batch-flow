
-- Fix printing group stage permissions
-- This ensures print operators can see jobs in printing-related stages

-- First, let's ensure we have the printing user group
INSERT INTO public.user_groups (name, description) 
VALUES ('Printing', 'Print operators and printing staff')
ON CONFLICT (name) DO NOTHING;

-- Get the printing group ID and assign permissions to printing-related stages
WITH printing_group AS (
  SELECT id FROM public.user_groups WHERE name = 'Printing' LIMIT 1
),
printing_stages AS (
  SELECT id FROM public.production_stages 
  WHERE name ILIKE '%print%' 
     OR name ILIKE '%hp%' 
     OR master_queue_id IN (
       SELECT id FROM public.production_stages WHERE name ILIKE '%hp%'
     )
)
INSERT INTO public.user_group_stage_permissions (
  user_group_id, 
  production_stage_id, 
  can_view, 
  can_edit, 
  can_work, 
  can_manage
)
SELECT 
  pg.id,
  ps.id,
  true,   -- can_view
  false,  -- can_edit
  true,   -- can_work (this is key for operators)
  false   -- can_manage
FROM printing_group pg
CROSS JOIN printing_stages ps
ON CONFLICT (user_group_id, production_stage_id) 
DO UPDATE SET 
  can_view = true,
  can_work = true,
  updated_at = now();
