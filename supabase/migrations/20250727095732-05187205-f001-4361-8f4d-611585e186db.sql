-- Create stage capacity profiles table
CREATE TABLE public.stage_capacity_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_stage_id UUID NOT NULL,
  daily_capacity_hours INTEGER NOT NULL DEFAULT 8,
  max_parallel_jobs INTEGER NOT NULL DEFAULT 1,
  setup_time_minutes INTEGER NOT NULL DEFAULT 0,
  is_bottleneck BOOLEAN NOT NULL DEFAULT false,
  working_days_per_week INTEGER NOT NULL DEFAULT 5,
  shift_hours_per_day INTEGER NOT NULL DEFAULT 8,
  efficiency_factor DECIMAL(3,2) NOT NULL DEFAULT 0.85,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(production_stage_id)
);

-- Create stage workload tracking table
CREATE TABLE public.stage_workload_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_stage_id UUID NOT NULL,
  date DATE NOT NULL,
  committed_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  available_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  queue_length_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  pending_jobs_count INTEGER NOT NULL DEFAULT 0,
  active_jobs_count INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(production_stage_id, date)
);

-- Create job flow dependencies table
CREATE TABLE public.job_flow_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  job_table_name TEXT NOT NULL,
  predecessor_stage_id UUID,
  current_stage_id UUID NOT NULL,
  successor_stage_id UUID,
  dependency_type TEXT NOT NULL DEFAULT 'sequential', -- 'sequential', 'parallel', 'merge'
  is_critical_path BOOLEAN NOT NULL DEFAULT false,
  estimated_start_date DATE,
  estimated_completion_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.stage_capacity_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_workload_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_flow_dependencies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow authenticated users to view stage capacity profiles"
ON public.stage_capacity_profiles FOR SELECT
USING (true);

CREATE POLICY "Allow admins to manage stage capacity profiles"
ON public.stage_capacity_profiles FOR ALL
USING (is_admin_simple());

CREATE POLICY "Allow authenticated users to view stage workload tracking"
ON public.stage_workload_tracking FOR SELECT
USING (true);

CREATE POLICY "Allow system to manage stage workload tracking"
ON public.stage_workload_tracking FOR ALL
USING (true);

CREATE POLICY "Allow authenticated users to view job flow dependencies"
ON public.job_flow_dependencies FOR SELECT
USING (true);

CREATE POLICY "Allow system to manage job flow dependencies"
ON public.job_flow_dependencies FOR ALL
USING (true);

-- Create function to calculate stage queue workload
CREATE OR REPLACE FUNCTION public.calculate_stage_queue_workload(p_production_stage_id UUID)
RETURNS TABLE(
  total_pending_hours DECIMAL(8,2),
  total_active_hours DECIMAL(8,2),
  pending_jobs_count INTEGER,
  active_jobs_count INTEGER,
  earliest_available_slot TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_capacity RECORD;
  daily_hours DECIMAL(8,2);
BEGIN
  -- Get stage capacity info
  SELECT daily_capacity_hours, efficiency_factor
  INTO stage_capacity
  FROM public.stage_capacity_profiles
  WHERE production_stage_id = p_production_stage_id;
  
  IF NOT FOUND THEN
    -- Default capacity if not configured
    daily_hours := 8.0;
  ELSE
    daily_hours := stage_capacity.daily_capacity_hours * stage_capacity.efficiency_factor;
  END IF;
  
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN jsi.status = 'pending' THEN jsi.estimated_duration_minutes END), 0) / 60.0 as total_pending_hours,
    COALESCE(SUM(CASE WHEN jsi.status = 'active' THEN jsi.estimated_duration_minutes END), 0) / 60.0 as total_active_hours,
    COUNT(CASE WHEN jsi.status = 'pending' THEN 1 END)::INTEGER as pending_jobs_count,
    COUNT(CASE WHEN jsi.status = 'active' THEN 1 END)::INTEGER as active_jobs_count,
    (now() + INTERVAL '1 hour' * (COALESCE(SUM(jsi.estimated_duration_minutes), 0) / 60.0 / daily_hours)) as earliest_available_slot
  FROM public.job_stage_instances jsi
  WHERE jsi.production_stage_id = p_production_stage_id
    AND jsi.status IN ('pending', 'active');
END;
$$;

-- Create function to update stage workload tracking
CREATE OR REPLACE FUNCTION public.update_stage_workload_tracking()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_record RECORD;
  workload_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  -- Update workload tracking for all active production stages
  FOR stage_record IN
    SELECT id, name FROM public.production_stages WHERE is_active = true
  LOOP
    -- Calculate current workload for this stage
    SELECT * INTO workload_record
    FROM public.calculate_stage_queue_workload(stage_record.id);
    
    -- Insert or update today's workload tracking
    INSERT INTO public.stage_workload_tracking (
      production_stage_id,
      date,
      committed_hours,
      queue_length_hours,
      pending_jobs_count,
      active_jobs_count,
      calculated_at
    ) VALUES (
      stage_record.id,
      CURRENT_DATE,
      workload_record.total_active_hours,
      workload_record.total_pending_hours,
      workload_record.pending_jobs_count,
      workload_record.active_jobs_count,
      now()
    )
    ON CONFLICT (production_stage_id, date)
    DO UPDATE SET
      committed_hours = EXCLUDED.committed_hours,
      queue_length_hours = EXCLUDED.queue_length_hours,
      pending_jobs_count = EXCLUDED.pending_jobs_count,
      active_jobs_count = EXCLUDED.active_jobs_count,
      calculated_at = EXCLUDED.calculated_at,
      updated_at = now();
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$;

-- Insert default capacity profiles for existing stages
INSERT INTO public.stage_capacity_profiles (production_stage_id, daily_capacity_hours, max_parallel_jobs, is_bottleneck)
SELECT 
  id,
  CASE 
    WHEN name ILIKE '%dtp%' OR name ILIKE '%prepress%' THEN 16  -- DTP can work longer hours
    WHEN name ILIKE '%hp%' OR name ILIKE '%print%' THEN 8      -- Standard printing hours
    WHEN name ILIKE '%lamina%' THEN 8                          -- Laminating
    WHEN name ILIKE '%saddle%' OR name ILIKE '%bind%' THEN 8   -- Binding operations
    ELSE 8
  END as daily_capacity_hours,
  CASE 
    WHEN name ILIKE '%dtp%' THEN 3                             -- Multiple DTP operators
    WHEN name ILIKE '%lamina%' THEN 2                          -- Can batch laminate
    ELSE 1
  END as max_parallel_jobs,
  CASE 
    WHEN name ILIKE '%hp%' OR name ILIKE '%print%' THEN true   -- Printing is typically bottleneck
    ELSE false
  END as is_bottleneck
FROM public.production_stages 
WHERE is_active = true
ON CONFLICT (production_stage_id) DO NOTHING;