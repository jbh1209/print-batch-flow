-- Add new fields to production_jobs table for enhanced Excel data
ALTER TABLE public.production_jobs 
ADD COLUMN IF NOT EXISTS size text,
ADD COLUMN IF NOT EXISTS specification text,
ADD COLUMN IF NOT EXISTS contact text;

-- Add new fields to ParsedJob interface equivalent in database
-- These will store detailed group-based specifications
ALTER TABLE public.production_jobs
ADD COLUMN IF NOT EXISTS paper_specifications jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS delivery_specifications jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS finishing_specifications jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS prepress_specifications jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS printing_specifications jsonb DEFAULT '{}';

-- Add operation quantities separate from total quantities
ALTER TABLE public.production_jobs
ADD COLUMN IF NOT EXISTS operation_quantities jsonb DEFAULT '{}';

COMMENT ON COLUMN public.production_jobs.size IS 'Size information from Excel (e.g., dimensions, format)';
COMMENT ON COLUMN public.production_jobs.specification IS 'Additional specification line from Excel';
COMMENT ON COLUMN public.production_jobs.contact IS 'Contact information from Excel';
COMMENT ON COLUMN public.production_jobs.paper_specifications IS 'Detailed paper specifications extracted from Paper group';
COMMENT ON COLUMN public.production_jobs.delivery_specifications IS 'Delivery method and specifications from Delivery group';
COMMENT ON COLUMN public.production_jobs.finishing_specifications IS 'Finishing operations and specifications from Finishing group';
COMMENT ON COLUMN public.production_jobs.prepress_specifications IS 'Pre-press specifications mapped to DTP and proofing stages';
COMMENT ON COLUMN public.production_jobs.printing_specifications IS 'Printing specifications and sub-specs from Printing group';
COMMENT ON COLUMN public.production_jobs.operation_quantities IS 'Quantities per operation/stage separate from total WO quantity';