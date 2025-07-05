-- SAFER FIX: Handle the stage order corruption step by step
-- First, let's just fix the specific jobs that are stuck

-- Step 1: Fix D425114 and D425127 specifically
-- Activate their Batch Allocation stages and mark them as batch ready

UPDATE job_stage_instances
SET 
  status = 'active',
  started_at = now(),
  started_by = (SELECT id FROM auth.users LIMIT 1),
  updated_at = now()
WHERE job_id IN (
  SELECT id FROM production_jobs WHERE wo_no IN ('D425114', 'D425127')
) 
AND production_stage_id = (SELECT id FROM production_stages WHERE name = 'Batch Allocation')
AND status = 'pending';

-- Step 2: Mark these jobs as ready for batching
UPDATE production_jobs
SET 
  batch_ready = true,
  batch_allocated_at = now(),
  batch_allocated_by = (SELECT id FROM auth.users LIMIT 1),
  status = 'Ready for Batch',
  updated_at = now()
WHERE wo_no IN ('D425114', 'D425127');

-- Step 3: Add some logging to help debug the advance_job_to_batch_allocation function
-- Create a simple log table to track what's happening
CREATE TABLE IF NOT EXISTS public.batch_allocation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  wo_no text,
  action text NOT NULL,
  details text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on the log table
ALTER TABLE public.batch_allocation_logs ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow authenticated users to view logs
CREATE POLICY "Users can view batch allocation logs" 
ON public.batch_allocation_logs 
FOR SELECT 
USING (true);