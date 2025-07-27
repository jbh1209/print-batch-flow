-- Remove job_scheduling table and its policies (cleanup from old scheduling system)
DROP TABLE IF EXISTS public.job_scheduling CASCADE;