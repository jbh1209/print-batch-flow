-- Add RLS policy to allow public access to job_stage_instances via valid proof links
CREATE POLICY "Public can view stage via valid proof link"
ON job_stage_instances
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM proof_links 
    WHERE proof_links.stage_instance_id = job_stage_instances.id
    AND proof_links.expires_at > now()
    AND proof_links.is_used = false
  )
);