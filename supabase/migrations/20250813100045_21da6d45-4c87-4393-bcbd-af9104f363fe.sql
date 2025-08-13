-- Phase 1: Create new scheduling database schema

-- Table for configurable working hours/shifts
CREATE TABLE public.shift_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday, etc
  shift_start_time TIME NOT NULL DEFAULT '08:00:00',
  shift_end_time TIME NOT NULL DEFAULT '16:30:00',
  is_working_day BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(day_of_week)
);

-- Insert default working hours (Monday to Friday 8:00-16:30)
INSERT INTO public.shift_schedules (day_of_week, shift_start_time, shift_end_time, is_working_day) VALUES
(1, '08:00:00', '16:30:00', true),  -- Monday
(2, '08:00:00', '16:30:00', true),  -- Tuesday
(3, '08:00:00', '16:30:00', true),  -- Wednesday
(4, '08:00:00', '16:30:00', true),  -- Thursday
(5, '08:00:00', '16:30:00', true),  -- Friday
(0, '08:00:00', '16:30:00', false), -- Sunday (off)
(6, '08:00:00', '16:30:00', false); -- Saturday (off)

-- Table for tracking exact time slots per production stage
CREATE TABLE public.stage_time_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_stage_id UUID NOT NULL,
  date DATE NOT NULL,
  slot_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  slot_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  job_id UUID,
  job_table_name TEXT DEFAULT 'production_jobs',
  stage_instance_id UUID,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(production_stage_id, slot_start_time)
);

-- Add scheduling columns to job_stage_instances if not exists
ALTER TABLE public.job_stage_instances 
ADD COLUMN IF NOT EXISTS auto_scheduled_start_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_scheduled_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_scheduled_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS is_split_job BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS split_job_part INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS split_job_total_parts INTEGER DEFAULT 1;

-- Enable RLS
ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_time_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage shift schedules" ON public.shift_schedules FOR ALL 
USING (is_admin_simple()) WITH CHECK (is_admin_simple());

CREATE POLICY "All users can view shift schedules" ON public.shift_schedules FOR SELECT 
USING (true);

CREATE POLICY "System can manage stage time slots" ON public.stage_time_slots FOR ALL 
USING (true);

CREATE POLICY "All users can view stage time slots" ON public.stage_time_slots FOR SELECT 
USING (true);

-- Function to trigger auto-scheduler when job is approved
CREATE OR REPLACE FUNCTION public.auto_schedule_job_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to 'In Production' or similar approved state
  IF NEW.status = 'In Production' AND (OLD.status IS NULL OR OLD.status != 'In Production') THEN
    -- Call the auto-scheduler edge function asynchronously
    PERFORM net.http_post(
      url := 'https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/auto-scheduler',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXp1c2dxZXhtbGZjcWZqb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTQwNzAsImV4cCI6MjA2MDEzMDA3MH0.NA2wRme-L8Z15my7n8u-BCQtO4Nw2opfsX0KSLYcs-I"}'::jsonb,
      body := json_build_object(
        'job_id', NEW.id,
        'job_table_name', 'production_jobs',
        'trigger_reason', 'job_approved'
      )::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on production_jobs
DROP TRIGGER IF EXISTS auto_schedule_on_approval ON public.production_jobs;
CREATE TRIGGER auto_schedule_on_approval
  AFTER UPDATE ON public.production_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_schedule_job_on_approval();