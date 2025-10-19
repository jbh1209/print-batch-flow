-- Create die_cutting_machines table
CREATE TABLE IF NOT EXISTS public.die_cutting_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  machine_type TEXT NOT NULL CHECK (machine_type IN ('cylinder', 'platten')),
  location TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'offline')),
  max_concurrent_jobs INTEGER DEFAULT 1,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add allocated_machine_id column to job_stage_instances
ALTER TABLE public.job_stage_instances 
ADD COLUMN IF NOT EXISTS allocated_machine_id UUID REFERENCES public.die_cutting_machines(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_jsi_allocated_machine ON public.job_stage_instances(allocated_machine_id);
CREATE INDEX IF NOT EXISTS idx_jsi_stage_allocation ON public.job_stage_instances(production_stage_id, allocated_machine_id) WHERE status IN ('pending', 'active');

-- Enable RLS on die_cutting_machines
ALTER TABLE public.die_cutting_machines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for die_cutting_machines
CREATE POLICY "Authenticated users can view die cutting machines"
ON public.die_cutting_machines
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage die cutting machines"
ON public.die_cutting_machines
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Managers can manage die cutting machines"
ON public.die_cutting_machines
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'manager'
  )
);

-- Insert 5 initial die cutting machines
INSERT INTO public.die_cutting_machines (name, machine_type, location, status, sort_order) VALUES
('Die Cut #1', 'cylinder', 'Die Cutting Department', 'active', 1),
('Die Cut #2', 'cylinder', 'Die Cutting Department', 'active', 2),
('Die Cut #3', 'cylinder', 'Die Cutting Department', 'active', 3),
('Hand Fed #1', 'platten', 'Die Cutting Department', 'active', 4),
('Hand Fed #2', 'platten', 'Die Cutting Department', 'active', 5)
ON CONFLICT DO NOTHING;

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_die_cutting_machines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_die_cutting_machines_updated_at
BEFORE UPDATE ON public.die_cutting_machines
FOR EACH ROW
EXECUTE FUNCTION update_die_cutting_machines_updated_at();