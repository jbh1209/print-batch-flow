-- Add due date warning columns to production_jobs table
ALTER TABLE public.production_jobs 
ADD COLUMN IF NOT EXISTS due_date_warning_level text DEFAULT 'green' CHECK (due_date_warning_level IN ('green', 'amber', 'red', 'critical')),
ADD COLUMN IF NOT EXISTS last_due_date_check timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS due_date_buffer_days integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS internal_completion_date date,
ADD COLUMN IF NOT EXISTS due_date_locked boolean DEFAULT false;