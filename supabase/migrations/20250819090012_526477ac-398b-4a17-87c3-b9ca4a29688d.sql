-- Add RLS policy to allow service role to update job_stage_instances for scheduling
CREATE POLICY "Allow service role to update job stages for scheduling"
ON public.job_stage_instances
FOR UPDATE
USING (true)
WITH CHECK (true);