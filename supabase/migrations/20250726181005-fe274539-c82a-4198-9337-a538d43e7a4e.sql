-- Create production scheduling tables

-- Production schedule table for daily planning
CREATE TABLE public.production_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  total_capacity_hours INTEGER NOT NULL DEFAULT 8,
  scheduled_hours INTEGER NOT NULL DEFAULT 0,
  available_hours INTEGER GENERATED ALWAYS AS (total_capacity_hours - scheduled_hours) STORED,
  is_working_day BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date)
);

-- Machine availability tracking
CREATE TABLE public.machine_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_name TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'breakdown', 'offline')),
  downtime_start TIMESTAMP WITH TIME ZONE,
  downtime_end TIMESTAMP WITH TIME ZONE,
  capacity_hours INTEGER NOT NULL DEFAULT 8,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(machine_name, date)
);

-- Job scheduling details
CREATE TABLE public.job_scheduling (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  job_table_name TEXT NOT NULL,
  scheduled_start_date DATE,
  scheduled_completion_date DATE,
  estimated_total_hours DECIMAL(10,2),
  actual_total_hours DECIMAL(10,2),
  schedule_priority INTEGER NOT NULL DEFAULT 100,
  is_expedited BOOLEAN NOT NULL DEFAULT false,
  schedule_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Production workload summary by day
CREATE TABLE public.daily_workload (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  total_jobs INTEGER NOT NULL DEFAULT 0,
  total_estimated_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  capacity_utilization DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_estimated_hours > 0 THEN (total_estimated_hours / 8.0) * 100
      ELSE 0
    END
  ) STORED,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date)
);

-- Enable RLS on all tables
ALTER TABLE public.production_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_scheduling ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_workload ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to view production schedule" 
ON public.production_schedule FOR SELECT 
USING (true);

CREATE POLICY "Allow admins to manage production schedule" 
ON public.production_schedule FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Allow authenticated users to view machine availability" 
ON public.machine_availability FOR SELECT 
USING (true);

CREATE POLICY "Allow admins to manage machine availability" 
ON public.machine_availability FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Allow authenticated users to view job scheduling" 
ON public.job_scheduling FOR SELECT 
USING (true);

CREATE POLICY "Allow users to manage job scheduling" 
ON public.job_scheduling FOR ALL 
USING (true);

CREATE POLICY "Allow authenticated users to view daily workload" 
ON public.daily_workload FOR SELECT 
USING (true);

CREATE POLICY "Allow system to update daily workload" 
ON public.daily_workload FOR ALL 
USING (true);

-- Create function to calculate smart due dates
CREATE OR REPLACE FUNCTION public.calculate_smart_due_date(
  p_estimated_hours DECIMAL,
  p_priority INTEGER DEFAULT 100
)
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_date DATE := CURRENT_DATE;
  working_day DATE;
  total_workload DECIMAL := 0;
  daily_capacity INTEGER := 8;
  days_needed INTEGER;
BEGIN
  -- Calculate total workload from existing scheduled jobs
  SELECT COALESCE(SUM(estimated_total_hours), 0) 
  INTO total_workload
  FROM public.job_scheduling js
  WHERE js.scheduled_start_date >= current_date;
  
  -- Add the new job's workload
  total_workload := total_workload + p_estimated_hours;
  
  -- Calculate working days needed (8 hours per day)
  days_needed := CEIL(total_workload / daily_capacity);
  
  -- Find the target working day
  working_day := current_date;
  WHILE days_needed > 0 LOOP
    working_day := working_day + INTERVAL '1 day';
    
    -- Skip weekends and check if it's a working day
    IF EXTRACT(DOW FROM working_day) NOT IN (0, 6) 
       AND NOT EXISTS (
         SELECT 1 FROM public.public_holidays 
         WHERE date = working_day AND is_active = true
       ) THEN
      days_needed := days_needed - 1;
    END IF;
  END LOOP;
  
  RETURN working_day;
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_production_schedule_date ON public.production_schedule(date);
CREATE INDEX idx_machine_availability_date ON public.machine_availability(machine_name, date);
CREATE INDEX idx_job_scheduling_dates ON public.job_scheduling(scheduled_start_date, scheduled_completion_date);
CREATE INDEX idx_job_scheduling_job ON public.job_scheduling(job_id, job_table_name);
CREATE INDEX idx_daily_workload_date ON public.daily_workload(date);