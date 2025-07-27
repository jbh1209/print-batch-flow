-- Fix RLS policies for job_scheduling table
-- First check if RLS is enabled
ALTER TABLE public.job_scheduling ENABLE ROW LEVEL SECURITY;

-- Add policies for job scheduling operations
CREATE POLICY "Users can insert job scheduling records" 
ON public.job_scheduling 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can read job scheduling records" 
ON public.job_scheduling 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can update job scheduling records" 
ON public.job_scheduling 
FOR UPDATE 
TO authenticated
USING (true);