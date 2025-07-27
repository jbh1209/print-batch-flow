-- Clean up old test data, keeping only the current 17 production jobs and their related data

-- 1. Delete orphaned job stage instances (not linked to current production jobs)
DELETE FROM job_stage_instances 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 2. Delete orphaned job print specifications 
DELETE FROM job_print_specifications 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 3. Delete orphaned job flow dependencies
DELETE FROM job_flow_dependencies 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 4. Delete orphaned proof links
DELETE FROM proof_links 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 5. Delete orphaned job priority overrides
DELETE FROM job_priority_overrides 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 6. Delete orphaned active job assignments
DELETE FROM active_job_assignments 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 7. Clean up any test jobs from other job tables that might have accumulated
DELETE FROM box_jobs WHERE created_at < '2025-07-27'::date;
DELETE FROM flyer_jobs WHERE created_at < '2025-07-27'::date;
DELETE FROM postcard_jobs WHERE created_at < '2025-07-27'::date;
DELETE FROM cover_jobs WHERE created_at < '2025-07-27'::date;
DELETE FROM product_pages WHERE created_at < '2025-07-27'::date;

-- 8. Clean up old batches and batch references that don't relate to current jobs
DELETE FROM batch_job_references 
WHERE production_job_id NOT IN (SELECT id FROM production_jobs);

DELETE FROM batches 
WHERE id NOT IN (SELECT DISTINCT batch_id FROM batch_job_references WHERE batch_id IS NOT NULL);

-- 9. Reset due date recalculation queue
DELETE FROM due_date_recalculation_queue 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- 10. Clean up old stage workload tracking data (keep recent data only)
DELETE FROM stage_workload_tracking 
WHERE date < CURRENT_DATE - INTERVAL '7 days';

-- 11. Clean up old machine availability data (keep recent data only)  
DELETE FROM machine_availability 
WHERE date < CURRENT_DATE - INTERVAL '30 days';

-- Show cleanup summary
SELECT 
  'Cleanup completed' as status,
  (SELECT COUNT(*) FROM production_jobs) as remaining_production_jobs,
  (SELECT COUNT(*) FROM job_stage_instances) as remaining_stage_instances;