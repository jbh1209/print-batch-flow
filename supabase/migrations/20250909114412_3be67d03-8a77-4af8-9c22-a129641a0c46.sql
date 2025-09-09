-- Fix scheduler to only schedule proof-approved jobs
-- CRITICAL FIX: Add proof approval filter that was missing

-- First, let's check the current scheduler_resource_fill_optimized function
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'scheduler_resource_fill_optimized' 
AND routine_schema = 'public';