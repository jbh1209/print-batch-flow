-- Create shipping_completions table
CREATE TABLE public.shipping_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  stage_instance_id UUID NOT NULL REFERENCES job_stage_instances(id) ON DELETE CASCADE,
  shipment_number INTEGER NOT NULL DEFAULT 1,
  qty_shipped INTEGER NOT NULL,
  qe_dn_number TEXT NOT NULL,
  courier_waybill_number TEXT,
  courier_waybill_url TEXT,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('courier', 'collection', 'local_delivery')),
  notes TEXT,
  shipped_by UUID REFERENCES auth.users(id),
  shipped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shipping_completions_qty_positive CHECK (qty_shipped > 0)
);

-- Enable RLS
ALTER TABLE public.shipping_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view shipping completions"
  ON public.shipping_completions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create shipping completions"
  ON public.shipping_completions FOR INSERT
  TO authenticated
  WITH CHECK (shipped_by = auth.uid());

CREATE POLICY "Users can update their own shipping completions"
  ON public.shipping_completions FOR UPDATE
  TO authenticated
  USING (shipped_by = auth.uid());

-- Indexes
CREATE INDEX idx_shipping_completions_job_id ON public.shipping_completions(job_id);
CREATE INDEX idx_shipping_completions_stage_instance_id ON public.shipping_completions(stage_instance_id);

-- Add shipping tracking fields to production_jobs
ALTER TABLE public.production_jobs
ADD COLUMN IF NOT EXISTS total_qty_shipped INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_partially_shipped BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS final_delivery_method TEXT;