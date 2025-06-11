
-- Add master_queue_id column to production_stages table
ALTER TABLE public.production_stages 
ADD COLUMN master_queue_id UUID REFERENCES public.production_stages(id);

-- Add index for better performance when querying by master_queue_id
CREATE INDEX idx_production_stages_master_queue_id ON public.production_stages(master_queue_id);
