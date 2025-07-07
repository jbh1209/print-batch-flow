-- Ensure foreign key constraint exists between job_stage_instances and production_stages
ALTER TABLE job_stage_instances 
DROP CONSTRAINT IF EXISTS job_stage_instances_production_stage_id_fkey;

ALTER TABLE job_stage_instances 
ADD CONSTRAINT job_stage_instances_production_stage_id_fkey 
FOREIGN KEY (production_stage_id) REFERENCES production_stages(id) 
ON DELETE CASCADE ON UPDATE CASCADE;