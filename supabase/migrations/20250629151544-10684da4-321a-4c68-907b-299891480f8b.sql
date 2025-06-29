
-- Add batch-related fields to production_jobs table
ALTER TABLE public.production_jobs 
ADD COLUMN IF NOT EXISTS batch_category text,
ADD COLUMN IF NOT EXISTS batch_ready boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS batch_allocated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS batch_allocated_by uuid;

-- Create a new production stage for "Batch Allocation"
INSERT INTO public.production_stages (name, description, color, order_index, is_active)
VALUES (
  'Batch Allocation',
  'Allocate jobs to production batches based on specifications',
  '#8B5CF6',
  150, -- Order after DTP/Proof stages
  true
)
ON CONFLICT (name) DO NOTHING;

-- Add paper weight to print specifications if not exists
INSERT INTO public.print_specifications (
  category,
  name,
  display_name,
  description,
  properties,
  is_active,
  sort_order
) VALUES 
(
  'paper_weight',
  '300gsm',
  '300gsm',
  'Standard business card weight',
  '{"weight": "300gsm", "thickness": "standard"}',
  true,
  1
),
(
  'paper_weight', 
  '350gsm',
  '350gsm', 
  'Premium business card weight',
  '{"weight": "350gsm", "thickness": "premium"}',
  true,
  2
),
(
  'paper_weight',
  '400gsm',
  '400gsm',
  'Heavy premium weight',
  '{"weight": "400gsm", "thickness": "heavy"}', 
  true,
  3
)
ON CONFLICT (category, name) DO NOTHING;

-- Create batch allocation permissions for user groups
-- This allows batch operators to work with the batch allocation stage
-- (Assumes batch operators will be added to appropriate user groups)

-- Add comment for tracking
COMMENT ON COLUMN public.production_jobs.batch_category IS 'Selected batch category (business_cards, flyers, etc.)';
COMMENT ON COLUMN public.production_jobs.batch_ready IS 'Job is ready for batch processing';
COMMENT ON COLUMN public.production_jobs.batch_allocated_at IS 'When job was allocated to batch processing';
COMMENT ON COLUMN public.production_jobs.batch_allocated_by IS 'User who allocated job to batch processing';
