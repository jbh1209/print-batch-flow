-- Phase 1: Add Batch Allocation Stage and Conditional Stage Support

-- First, add columns to production_stages for batch stage identification and conditional rendering
ALTER TABLE public.production_stages 
ADD COLUMN IF NOT EXISTS is_batch_stage boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_conditional boolean DEFAULT false;

-- Add columns to category_production_stages for conditional stage behavior
ALTER TABLE public.category_production_stages 
ADD COLUMN IF NOT EXISTS is_conditional boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS skip_when_inactive boolean DEFAULT false;

-- Create the Batch Allocation stage
INSERT INTO public.production_stages (
  name, 
  description, 
  color, 
  order_index, 
  is_active, 
  is_batch_stage, 
  is_conditional,
  is_multi_part, 
  part_definitions
) VALUES (
  'Batch Allocation',
  'Jobs ready for batching - allocate to production batches',
  '#8B5CF6',
  150, -- Between proof (100) and printing stages (200+)
  true,
  true,
  true,
  false,
  '[]'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  is_batch_stage = true,
  is_conditional = true,
  color = '#8B5CF6',
  order_index = 150;

-- Get the batch allocation stage ID
DO $$
DECLARE
  batch_stage_id uuid;
  category_record RECORD;
BEGIN
  -- Get the batch allocation stage ID
  SELECT id INTO batch_stage_id 
  FROM public.production_stages 
  WHERE name = 'Batch Allocation';
  
  -- Add batch allocation stage to all existing categories
  FOR category_record IN 
    SELECT id FROM public.categories
  LOOP
    INSERT INTO public.category_production_stages (
      category_id,
      production_stage_id,
      stage_order,
      estimated_duration_hours,
      is_required,
      is_conditional,
      skip_when_inactive
    ) VALUES (
      category_record.id,
      batch_stage_id,
      150, -- Same as stage order_index
      1, -- Minimal duration for allocation
      false, -- Not required by default
      true, -- Conditional stage
      true -- Skip when not active
    ) ON CONFLICT (category_id, production_stage_id) DO UPDATE SET
      is_conditional = true,
      skip_when_inactive = true,
      stage_order = 150;
  END LOOP;
END $$;

-- Add batch_ready column to production_jobs if it doesn't exist
ALTER TABLE public.production_jobs 
ADD COLUMN IF NOT EXISTS batch_ready boolean DEFAULT false;