-- Remove problematic job_flow_dependencies table that's causing constraint violations
DROP TABLE IF EXISTS public.job_flow_dependencies CASCADE;