-- Clean up old test data in the correct order to avoid foreign key constraints

-- 1. First delete proof links that reference orphaned stage instances
DELETE FROM proof_links 
WHERE stage_instance_id IN (
  SELECT id FROM job_stage_instances 
  WHERE job_id NOT IN (SELECT id FROM production_jobs)
);

-- 2. Delete orphaned job stage instances (not linked to current production jobs)
DELETE FROM job_stage_instances 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 3. Delete orphaned job print specifications 
DELETE FROM job_print_specifications 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 4. Delete orphaned job flow dependencies
DELETE FROM job_flow_dependencies 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 5. Delete remaining orphaned proof links
DELETE FROM proof_links 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 6. Delete orphaned job priority overrides
DELETE FROM job_priority_overrides 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 7. Delete orphaned active job assignments
DELETE FROM active_job_assignments 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 8. Clean up any test jobs from other job tables that might have accumulated
DELETE FROM box_jobs WHERE created_at < '2025-07-27'::date;
DELETE FROM flyer_jobs WHERE created_at < '2025-07-27'::date;
DELETE FROM postcard_jobs WHERE created_at < '2025-07-27'::date;
DELETE FROM cover_jobs WHERE created_at < '2025-07-27'::date;
DELETE FROM product_pages WHERE created_at < '2025-07-27'::date;

-- 9. Clean up old batches and batch references that don't relate to current jobs
DELETE FROM batch_job_references 
WHERE production_job_id NOT IN (SELECT id FROM production_jobs);

DELETE FROM batches 
WHERE id NOT IN (SELECT DISTINCT batch_id FROM batch_job_references WHERE batch_id IS NOT NULL);

-- 10. Reset due date recalculation queue
DELETE FROM due_date_recalculation_queue 
WHERE job_id NOT IN (SELECT id FROM production_jobs);