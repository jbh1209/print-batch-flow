-- Create trigger function to clean up related data when production jobs are deleted
CREATE OR REPLACE FUNCTION cleanup_production_job_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean up job stage instances
  DELETE FROM job_stage_instances WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up job print specifications
  DELETE FROM job_print_specifications WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up job flow dependencies  
  DELETE FROM job_flow_dependencies WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up proof links
  DELETE FROM proof_links WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up active job assignments
  DELETE FROM active_job_assignments WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up due date recalculation queue
  DELETE FROM due_date_recalculation_queue WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up job priority overrides
  DELETE FROM job_priority_overrides WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically clean up when production jobs are deleted
DROP TRIGGER IF EXISTS trigger_cleanup_production_job_data ON production_jobs;
CREATE TRIGGER trigger_cleanup_production_job_data
  AFTER DELETE ON production_jobs
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_production_job_data();