-- Enhanced Production Stages with Timing Support
-- Add timing and speed fields to production_stages table
ALTER TABLE public.production_stages 
ADD COLUMN running_speed_per_hour INTEGER,
ADD COLUMN make_ready_time_minutes INTEGER DEFAULT 10,
ADD COLUMN speed_unit TEXT DEFAULT 'sheets_per_hour' CHECK (speed_unit IN ('sheets_per_hour', 'items_per_hour', 'minutes_per_item'));

-- Create stage_specifications table for detailed specifications within stages
CREATE TABLE public.stage_specifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_stage_id UUID NOT NULL REFERENCES public.production_stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  running_speed_per_hour INTEGER, -- Override stage default if specified
  make_ready_time_minutes INTEGER, -- Override stage default if specified  
  speed_unit TEXT CHECK (speed_unit IN ('sheets_per_hour', 'items_per_hour', 'minutes_per_item')),
  properties JSONB DEFAULT '{}', -- Flexible storage for spec-specific data
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(production_stage_id, name)
);

-- Enhance job_stage_instances with quantity and timing data
ALTER TABLE public.job_stage_instances
ADD COLUMN stage_specification_id UUID REFERENCES public.stage_specifications(id),
ADD COLUMN quantity INTEGER,
ADD COLUMN estimated_duration_minutes INTEGER,
ADD COLUMN actual_duration_minutes INTEGER,
ADD COLUMN setup_time_minutes INTEGER DEFAULT 0;

-- Create excel_import_mappings table for intelligent text-to-stage mapping
CREATE TABLE public.excel_import_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  excel_text TEXT NOT NULL, -- The raw text from Excel import
  production_stage_id UUID NOT NULL REFERENCES public.production_stages(id) ON DELETE CASCADE,
  stage_specification_id UUID REFERENCES public.stage_specifications(id) ON DELETE SET NULL,
  confidence_score INTEGER DEFAULT 100 CHECK (confidence_score >= 1 AND confidence_score <= 100),
  is_verified BOOLEAN NOT NULL DEFAULT false, -- Manual verification flag
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(excel_text, production_stage_id, stage_specification_id)
);

-- Add indexes for better performance
CREATE INDEX idx_stage_specifications_production_stage_id ON public.stage_specifications(production_stage_id);
CREATE INDEX idx_stage_specifications_active ON public.stage_specifications(is_active) WHERE is_active = true;
CREATE INDEX idx_job_stage_instances_specification_id ON public.job_stage_instances(stage_specification_id);
CREATE INDEX idx_excel_import_mappings_excel_text ON public.excel_import_mappings(excel_text);
CREATE INDEX idx_excel_import_mappings_stage_id ON public.excel_import_mappings(production_stage_id);
CREATE INDEX idx_excel_import_mappings_verified ON public.excel_import_mappings(is_verified);

-- Enable RLS on new tables
ALTER TABLE public.stage_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_import_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stage_specifications
CREATE POLICY "Users can view stage specifications" 
ON public.stage_specifications 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage stage specifications" 
ON public.stage_specifications 
FOR ALL 
USING (is_admin_simple())
WITH CHECK (is_admin_simple());

-- RLS Policies for excel_import_mappings  
CREATE POLICY "Users can view import mappings" 
ON public.excel_import_mappings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage import mappings" 
ON public.excel_import_mappings 
FOR ALL 
USING (is_admin_simple())
WITH CHECK (is_admin_simple());

-- Add helpful comments
COMMENT ON TABLE public.stage_specifications IS 'Detailed specifications within production stages for accurate timing and mapping';
COMMENT ON TABLE public.excel_import_mappings IS 'Maps Excel import text to production stages and specifications for automated workflow creation';
COMMENT ON COLUMN public.production_stages.running_speed_per_hour IS 'Base running speed for this stage (can be overridden by specifications)';
COMMENT ON COLUMN public.production_stages.make_ready_time_minutes IS 'Setup/changeover time in minutes for this stage';
COMMENT ON COLUMN public.job_stage_instances.quantity IS 'Quantity of items to be processed in this stage instance';
COMMENT ON COLUMN public.job_stage_instances.estimated_duration_minutes IS 'Calculated estimated time based on quantity and speed';
COMMENT ON COLUMN public.job_stage_instances.actual_duration_minutes IS 'Actual time taken when completed';

-- Create function to calculate estimated duration
CREATE OR REPLACE FUNCTION public.calculate_stage_duration(
  p_quantity INTEGER,
  p_running_speed_per_hour INTEGER,
  p_make_ready_time_minutes INTEGER DEFAULT 10,
  p_speed_unit TEXT DEFAULT 'sheets_per_hour'
) RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  production_minutes INTEGER;
  total_minutes INTEGER;
BEGIN
  -- Handle null or zero values
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_running_speed_per_hour IS NULL OR p_running_speed_per_hour <= 0 THEN
    RETURN COALESCE(p_make_ready_time_minutes, 10);
  END IF;
  
  -- Calculate production time based on speed unit
  CASE p_speed_unit
    WHEN 'sheets_per_hour', 'items_per_hour' THEN
      production_minutes := CEIL((p_quantity::NUMERIC / p_running_speed_per_hour::NUMERIC) * 60);
    WHEN 'minutes_per_item' THEN
      production_minutes := p_quantity * p_running_speed_per_hour;
    ELSE
      production_minutes := CEIL((p_quantity::NUMERIC / p_running_speed_per_hour::NUMERIC) * 60);
  END CASE;
  
  -- Add make-ready time
  total_minutes := production_minutes + COALESCE(p_make_ready_time_minutes, 10);
  
  RETURN total_minutes;
END;
$$;