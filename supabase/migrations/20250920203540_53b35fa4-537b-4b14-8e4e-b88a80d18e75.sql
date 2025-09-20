-- Create HP12000 paper sizes lookup table
CREATE TABLE IF NOT EXISTS hp12000_paper_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  dimensions TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE hp12000_paper_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view HP12000 paper sizes"
  ON hp12000_paper_sizes FOR SELECT 
  USING (true);

CREATE POLICY "Admins can manage HP12000 paper sizes"
  ON hp12000_paper_sizes FOR ALL
  USING (is_admin_simple())
  WITH CHECK (is_admin_simple());

-- Insert default paper sizes
INSERT INTO hp12000_paper_sizes (name, dimensions, sort_order) VALUES
  ('Large (750x530mm)', '750x530mm', 1),
  ('Small (640x455mm)', '640x455mm', 2)
ON CONFLICT (name) DO NOTHING;

-- Add paper size tracking to job stage instances
ALTER TABLE job_stage_instances 
ADD COLUMN IF NOT EXISTS hp12000_paper_size_id UUID REFERENCES hp12000_paper_sizes(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_job_stage_instances_hp12000_paper_size 
ON job_stage_instances(hp12000_paper_size_id);

-- Function to check if a stage is HP12000
CREATE OR REPLACE FUNCTION is_hp12000_stage(stage_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN stage_name ~* '(hp.*12000|12000|printing.*hp.*12000)';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get all HP12000 stages for a job
CREATE OR REPLACE FUNCTION get_job_hp12000_stages(p_job_id UUID)
RETURNS TABLE(
  stage_instance_id UUID,
  production_stage_id UUID,
  stage_name TEXT,
  stage_order INTEGER,
  paper_size_id UUID,
  paper_size_name TEXT,
  is_paper_size_required BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jsi.id as stage_instance_id,
    jsi.production_stage_id,
    ps.name as stage_name,
    jsi.stage_order,
    jsi.hp12000_paper_size_id as paper_size_id,
    hps.name as paper_size_name,
    is_hp12000_stage(ps.name) as is_paper_size_required
  FROM job_stage_instances jsi
  JOIN production_stages ps ON ps.id = jsi.production_stage_id
  LEFT JOIN hp12000_paper_sizes hps ON hps.id = jsi.hp12000_paper_size_id
  WHERE jsi.job_id = p_job_id
    AND jsi.job_table_name = 'production_jobs'
    AND is_hp12000_stage(ps.name) = true
  ORDER BY jsi.stage_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;