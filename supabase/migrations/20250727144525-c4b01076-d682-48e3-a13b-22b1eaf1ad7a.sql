-- Clean up orphaned job stage instances after production jobs deletion
DELETE FROM job_stage_instances 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- Clean up any other orphaned data
DELETE FROM job_print_specifications 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

DELETE FROM job_flow_dependencies 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

DELETE FROM proof_links 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

DELETE FROM active_job_assignments 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

DELETE FROM due_date_recalculation_queue 
WHERE job_id NOT IN (SELECT id FROM production_jobs);

-- Show cleanup results
SELECT 
  'After job deletion cleanup' as status,
  (SELECT COUNT(*) FROM production_jobs) as production_jobs,
  (SELECT COUNT(*) FROM job_stage_instances) as stage_instances;