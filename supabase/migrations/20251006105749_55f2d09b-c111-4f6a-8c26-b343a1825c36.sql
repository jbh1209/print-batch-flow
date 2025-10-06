-- Phase 4: Add foreign key constraint for admin panel proof link lookup

-- Add foreign key to enable Supabase query builder joins
ALTER TABLE proof_links
ADD CONSTRAINT proof_links_job_id_fkey 
FOREIGN KEY (job_id) 
REFERENCES production_jobs(id) 
ON DELETE CASCADE;

-- Add comment for documentation
COMMENT ON CONSTRAINT proof_links_job_id_fkey ON proof_links 
IS 'Links proof_links to production_jobs for automatic query joins in admin panel';