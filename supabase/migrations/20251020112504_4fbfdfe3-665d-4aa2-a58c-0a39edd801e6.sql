-- Fix proof_links foreign key constraints to allow job deletion
-- Drop existing foreign key constraint on stage_instance_id
ALTER TABLE proof_links 
DROP CONSTRAINT IF EXISTS fk_proof_links_stage_instance;

-- Recreate with ON DELETE CASCADE
ALTER TABLE proof_links
ADD CONSTRAINT fk_proof_links_stage_instance
FOREIGN KEY (stage_instance_id)
REFERENCES job_stage_instances(id)
ON DELETE CASCADE;

-- Drop and recreate job_id foreign key with CASCADE
ALTER TABLE proof_links
DROP CONSTRAINT IF EXISTS proof_links_job_id_fkey;

ALTER TABLE proof_links
ADD CONSTRAINT proof_links_job_id_fkey
FOREIGN KEY (job_id)
REFERENCES production_jobs(id)
ON DELETE CASCADE;