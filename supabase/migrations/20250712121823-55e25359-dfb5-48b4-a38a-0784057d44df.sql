-- Add ignore_excel_quantity override field to production_stages table
ALTER TABLE public.production_stages 
ADD COLUMN ignore_excel_quantity boolean DEFAULT false;

-- Add ignore_excel_quantity override field to stage_specifications table  
ALTER TABLE public.stage_specifications
ADD COLUMN ignore_excel_quantity boolean DEFAULT false;

-- Update the calculate_stage_timing_with_inheritance logic to respect overrides
-- This will be handled in the application code, but we're adding the DB foundation