-- Remove the problematic trigger that references non-existent job_flow_dependencies table
DROP TRIGGER IF EXISTS trigger_cleanup_production_job_data ON production_jobs;

-- Create a new cleanup trigger without the non-existent table reference
CREATE OR REPLACE FUNCTION public.cleanup_production_job_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean up job stage instances
  DELETE FROM job_stage_instances WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up job print specifications
  DELETE FROM job_print_specifications WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up proof links
  DELETE FROM proof_links WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up active job assignments
  DELETE FROM active_job_assignments WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up due date recalculation queue
  DELETE FROM due_date_recalculation_queue WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up job priority overrides
  DELETE FROM job_priority_overrides WHERE job_id = OLD.id AND job_table_name = 'production_jobs';
  
  -- Clean up batch job references
  DELETE FROM batch_job_references WHERE production_job_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger with the corrected function
CREATE TRIGGER trigger_cleanup_production_job_data
    BEFORE DELETE ON production_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_production_job_data();