-- Drop the 3-parameter version of scheduler_append_jobs that's causing conflicts
-- Only keep the 2-parameter version that the triggers are calling

DROP FUNCTION IF EXISTS public.scheduler_append_jobs(uuid[], timestamp with time zone, boolean);