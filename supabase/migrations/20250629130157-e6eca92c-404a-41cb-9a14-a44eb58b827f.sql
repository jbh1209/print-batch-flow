
-- Create central print specifications table (categories only - you'll add individual parameters)
CREATE TABLE public.print_specifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'paper_type', 'paper_weight', 'size', 'lamination_type', 'uv_varnish'
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  properties JSONB DEFAULT '{}', -- Additional properties specific to each specification
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users,
  UNIQUE(category, name)
);

-- Create product specification compatibility matrix
CREATE TABLE public.product_specification_compatibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_type TEXT NOT NULL, -- 'business_cards', 'flyers', 'postcards', etc.
  specification_id UUID NOT NULL REFERENCES public.print_specifications(id),
  is_compatible BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_type, specification_id)
);

-- Create job print specifications link table
CREATE TABLE public.job_print_specifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  job_table_name TEXT NOT NULL, -- 'business_card_jobs', 'flyer_jobs', etc.
  specification_category TEXT NOT NULL,
  specification_id UUID NOT NULL REFERENCES public.print_specifications(id),
  printer_id UUID REFERENCES public.printers(id), -- Link to existing printers table
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, job_table_name, specification_category)
);

-- Add batch allocation fields to job tables
ALTER TABLE public.business_card_jobs ADD COLUMN batch_ready BOOLEAN DEFAULT false;
ALTER TABLE public.business_card_jobs ADD COLUMN batch_allocated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.business_card_jobs ADD COLUMN batch_allocated_by UUID REFERENCES auth.users;

ALTER TABLE public.flyer_jobs ADD COLUMN batch_ready BOOLEAN DEFAULT false;
ALTER TABLE public.flyer_jobs ADD COLUMN batch_allocated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.flyer_jobs ADD COLUMN batch_allocated_by UUID REFERENCES auth.users;

ALTER TABLE public.postcard_jobs ADD COLUMN batch_ready BOOLEAN DEFAULT false;
ALTER TABLE public.postcard_jobs ADD COLUMN batch_allocated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.postcard_jobs ADD COLUMN batch_allocated_by UUID REFERENCES auth.users;

ALTER TABLE public.sleeve_jobs ADD COLUMN batch_ready BOOLEAN DEFAULT false;
ALTER TABLE public.sleeve_jobs ADD COLUMN batch_allocated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sleeve_jobs ADD COLUMN batch_allocated_by UUID REFERENCES auth.users;

ALTER TABLE public.sticker_jobs ADD COLUMN batch_ready BOOLEAN DEFAULT false;
ALTER TABLE public.sticker_jobs ADD COLUMN batch_allocated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sticker_jobs ADD COLUMN batch_allocated_by UUID REFERENCES auth.users;

ALTER TABLE public.poster_jobs ADD COLUMN batch_ready BOOLEAN DEFAULT false;
ALTER TABLE public.poster_jobs ADD COLUMN batch_allocated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.poster_jobs ADD COLUMN batch_allocated_by UUID REFERENCES auth.users;

ALTER TABLE public.cover_jobs ADD COLUMN batch_ready BOOLEAN DEFAULT false;
ALTER TABLE public.cover_jobs ADD COLUMN batch_allocated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.cover_jobs ADD COLUMN batch_allocated_by UUID REFERENCES auth.users;

ALTER TABLE public.box_jobs ADD COLUMN batch_ready BOOLEAN DEFAULT false;
ALTER TABLE public.box_jobs ADD COLUMN batch_allocated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.box_jobs ADD COLUMN batch_allocated_by UUID REFERENCES auth.users;

-- Add RLS policies
ALTER TABLE public.print_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_specification_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_print_specifications ENABLE ROW LEVEL SECURITY;

-- Policies for print_specifications (all users can read, only admins can modify)
CREATE POLICY "Everyone can view print specifications" ON public.print_specifications FOR SELECT USING (true);
CREATE POLICY "Admins can insert print specifications" ON public.print_specifications FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update print specifications" ON public.print_specifications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete print specifications" ON public.print_specifications FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Policies for product_specification_compatibility (all users can read, only admins can modify)
CREATE POLICY "Everyone can view product compatibility" ON public.product_specification_compatibility FOR SELECT USING (true);
CREATE POLICY "Admins can insert product compatibility" ON public.product_specification_compatibility FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update product compatibility" ON public.product_specification_compatibility FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete product compatibility" ON public.product_specification_compatibility FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Policies for job_print_specifications (users can manage their own job specs)
CREATE POLICY "Users can view job specifications" ON public.job_print_specifications FOR SELECT USING (true);
CREATE POLICY "Users can insert job specifications" ON public.job_print_specifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update job specifications" ON public.job_print_specifications FOR UPDATE USING (true);
CREATE POLICY "Users can delete job specifications" ON public.job_print_specifications FOR DELETE USING (true);

-- Insert only the high-level categories (you'll add individual parameters via admin interface)
INSERT INTO public.print_specifications (category, name, display_name, description) VALUES
('paper_type', '_category', 'Paper Type', 'Paper surface finish and coating'),
('paper_weight', '_category', 'Paper Weight', 'Paper thickness and weight specifications'),
('size', '_category', 'Size', 'Print dimensions and format sizes'),
('lamination_type', '_category', 'Lamination Type', 'Post-printing lamination finishes'),
('uv_varnish', '_category', 'UV Varnish', 'UV coating applications');

-- Add Batch Allocation stage to production_stages (check if exists first)
INSERT INTO public.production_stages (name, description, color, order_index, is_active) 
SELECT 'Batch Allocation', 'Allocate approved jobs to production batches', '#10B981', 15, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.production_stages WHERE name = 'Batch Allocation'
);

-- Create function to get compatible specifications for a product type
CREATE OR REPLACE FUNCTION public.get_compatible_specifications(p_product_type text, p_category text)
RETURNS TABLE(
  id uuid,
  name text,
  display_name text,
  description text,
  properties jsonb,
  is_default boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.name,
    ps.display_name,
    ps.description,
    ps.properties,
    COALESCE(psc.is_default, false) as is_default
  FROM public.print_specifications ps
  LEFT JOIN public.product_specification_compatibility psc ON (
    ps.id = psc.specification_id 
    AND psc.product_type = p_product_type
  )
  WHERE ps.category = p_category
    AND ps.is_active = true
    AND ps.name != '_category' -- Exclude category headers
    AND (psc.is_compatible IS NULL OR psc.is_compatible = true)
  ORDER BY ps.sort_order, ps.display_name;
END;
$$;

-- Create function to get job specifications with printer info
CREATE OR REPLACE FUNCTION public.get_job_specifications(p_job_id uuid, p_job_table_name text)
RETURNS TABLE(
  category text,
  specification_id uuid,
  name text,
  display_name text,
  properties jsonb,
  printer_id uuid,
  printer_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jps.specification_category,
    jps.specification_id,
    ps.name,
    ps.display_name,
    ps.properties,
    jps.printer_id,
    p.name as printer_name
  FROM public.job_print_specifications jps
  JOIN public.print_specifications ps ON jps.specification_id = ps.id
  LEFT JOIN public.printers p ON jps.printer_id = p.id
  WHERE jps.job_id = p_job_id 
    AND jps.job_table_name = p_job_table_name;
END;
$$;

-- Create function to mark job ready for batch allocation
CREATE OR REPLACE FUNCTION public.mark_job_ready_for_batching(
  p_job_id uuid, 
  p_job_table_name text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the appropriate job table
  EXECUTE format('
    UPDATE %I 
    SET batch_ready = true, 
        batch_allocated_at = now(), 
        batch_allocated_by = $1
    WHERE id = $2
  ', p_job_table_name) 
  USING p_user_id, p_job_id;
  
  RETURN true;
END;
$$;
