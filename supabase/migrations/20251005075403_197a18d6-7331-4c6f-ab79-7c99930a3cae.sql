-- Part 1: Create stage_sub_tasks table for multiple specifications per stage
CREATE TABLE IF NOT EXISTS public.stage_sub_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_instance_id UUID NOT NULL REFERENCES public.job_stage_instances(id) ON DELETE CASCADE,
  stage_specification_id UUID REFERENCES public.stage_specifications(id),
  sub_task_order INTEGER NOT NULL DEFAULT 1,
  quantity INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  started_by UUID,
  completed_by UUID,
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stage_instance_id, sub_task_order),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'completed', 'skipped', 'on_hold'))
);

-- Add index for faster queries
CREATE INDEX idx_stage_sub_tasks_stage_instance ON public.stage_sub_tasks(stage_instance_id);
CREATE INDEX idx_stage_sub_tasks_status ON public.stage_sub_tasks(status);

-- Enable RLS
ALTER TABLE public.stage_sub_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view sub-tasks"
  ON public.stage_sub_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sub-tasks"
  ON public.stage_sub_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sub-tasks"
  ON public.stage_sub_tasks FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete sub-tasks"
  ON public.stage_sub_tasks FOR DELETE
  TO authenticated
  USING (true);

-- Part 2: Add supports_multi_specifications to production_stages
ALTER TABLE public.production_stages 
ADD COLUMN IF NOT EXISTS supports_multi_specifications BOOLEAN DEFAULT false;

-- Enable multi-specifications for Handwork stage
UPDATE public.production_stages 
SET supports_multi_specifications = true 
WHERE id = 'c72a0c04-423f-4d0d-9a55-292ec378728f';

-- Part 3: Create helper function to get sub-tasks
CREATE OR REPLACE FUNCTION public.get_stage_sub_tasks(p_stage_instance_id UUID)
RETURNS TABLE (
  id UUID,
  stage_instance_id UUID,
  stage_specification_id UUID,
  specification_name TEXT,
  sub_task_order INTEGER,
  quantity INTEGER,
  status TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  started_by UUID,
  completed_by UUID,
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  notes TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    st.id,
    st.stage_instance_id,
    st.stage_specification_id,
    ss.name AS specification_name,
    st.sub_task_order,
    st.quantity,
    st.status,
    st.started_at,
    st.completed_at,
    st.started_by,
    st.completed_by,
    st.estimated_duration_minutes,
    st.actual_duration_minutes,
    st.notes
  FROM public.stage_sub_tasks st
  LEFT JOIN public.stage_specifications ss ON st.stage_specification_id = ss.id
  WHERE st.stage_instance_id = p_stage_instance_id
  ORDER BY st.sub_task_order ASC;
$$;