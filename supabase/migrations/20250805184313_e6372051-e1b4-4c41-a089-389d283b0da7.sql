-- Phase 1: Create Production Schedule Database Tables

-- Table for daily production capacity and allocation per stage
CREATE TABLE public.daily_production_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  production_stage_id uuid NOT NULL REFERENCES public.production_stages(id) ON DELETE CASCADE,
  total_capacity_minutes integer NOT NULL DEFAULT 480, -- 8 hours default
  allocated_minutes integer NOT NULL DEFAULT 0,
  available_minutes integer GENERATED ALWAYS AS (total_capacity_minutes - allocated_minutes) STORED,
  shift_number integer NOT NULL DEFAULT 1,
  is_working_day boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(date, production_stage_id, shift_number)
);

-- Table for job schedule assignments (replaces production_job_schedules)
CREATE TABLE public.job_schedule_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL,
  job_table_name text NOT NULL DEFAULT 'production_jobs',
  production_stage_id uuid NOT NULL REFERENCES public.production_stages(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  queue_position integer NOT NULL DEFAULT 1,
  shift_number integer NOT NULL DEFAULT 1,
  estimated_duration_minutes integer NOT NULL,
  actual_start_time timestamp with time zone,
  actual_end_time timestamp with time zone,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
  priority_score integer NOT NULL DEFAULT 100,
  is_expedited boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  calculation_run_id uuid,
  UNIQUE(job_id, production_stage_id, scheduled_date, shift_number)
);

-- Table for tracking schedule calculation runs
CREATE TABLE public.schedule_calculation_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  calculation_type text NOT NULL CHECK (calculation_type IN ('nightly_full', 'job_update', 'capacity_change', 'manual_reschedule')),
  trigger_reason text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  jobs_processed integer NOT NULL DEFAULT 0,
  stages_affected integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  execution_time_ms integer,
  created_by uuid
);

-- Enable RLS on all tables
ALTER TABLE public.daily_production_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_calculation_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_production_schedule
CREATE POLICY "Allow authenticated users to view daily schedules" 
ON public.daily_production_schedule FOR SELECT 
USING (true);

CREATE POLICY "Allow system to manage daily schedules" 
ON public.daily_production_schedule FOR ALL 
USING (true);

-- RLS Policies for job_schedule_assignments
CREATE POLICY "Allow authenticated users to view job assignments" 
ON public.job_schedule_assignments FOR SELECT 
USING (true);

CREATE POLICY "Allow system to manage job assignments" 
ON public.job_schedule_assignments FOR ALL 
USING (true);

-- RLS Policies for schedule_calculation_log
CREATE POLICY "Allow authenticated users to view calculation logs" 
ON public.schedule_calculation_log FOR SELECT 
USING (true);

CREATE POLICY "Allow system to manage calculation logs" 
ON public.schedule_calculation_log FOR ALL 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_daily_schedule_date_stage ON public.daily_production_schedule(date, production_stage_id);
CREATE INDEX idx_job_assignments_date_stage ON public.job_schedule_assignments(scheduled_date, production_stage_id);
CREATE INDEX idx_job_assignments_job_id ON public.job_schedule_assignments(job_id, job_table_name);
CREATE INDEX idx_calculation_log_run_id ON public.schedule_calculation_log(calculation_run_id);
CREATE INDEX idx_calculation_log_started_at ON public.schedule_calculation_log(started_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_schedule_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_production_schedule_timestamp
  BEFORE UPDATE ON public.daily_production_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_schedule_timestamp();

CREATE TRIGGER update_job_schedule_assignments_timestamp
  BEFORE UPDATE ON public.job_schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_schedule_timestamp();