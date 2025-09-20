-- Create secure RPC function for deleting production jobs and their dependencies
CREATE OR REPLACE FUNCTION public.delete_production_jobs(job_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_jobs_count integer := 0;
  deleted_children_count integer := 0;
  temp_count integer;
BEGIN
  -- Validate input
  IF job_ids IS NULL OR array_length(job_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No job IDs provided'
    );
  END IF;

  -- Start transaction to ensure consistency
  -- Delete dependent records first to avoid cascade conflicts
  
  -- Delete stage time slots
  DELETE FROM stage_time_slots 
  WHERE job_id = ANY(job_ids) AND job_table_name = 'production_jobs';
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_children_count := deleted_children_count + temp_count;
  
  -- Delete scheduling decision logs
  DELETE FROM scheduling_decision_logs 
  WHERE job_id = ANY(job_ids) AND job_table_name = 'production_jobs';
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_children_count := deleted_children_count + temp_count;
  
  -- Delete stage queue positions
  DELETE FROM stage_queue_positions 
  WHERE job_id = ANY(job_ids) AND job_table_name = 'production_jobs';
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_children_count := deleted_children_count + temp_count;
  
  -- Delete job stage instances
  DELETE FROM job_stage_instances 
  WHERE job_id = ANY(job_ids) AND job_table_name = 'production_jobs';
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_children_count := deleted_children_count + temp_count;
  
  -- Delete job print specifications
  DELETE FROM job_print_specifications 
  WHERE job_id = ANY(job_ids) AND job_table_name = 'production_jobs';
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_children_count := deleted_children_count + temp_count;
  
  -- Delete active job assignments
  DELETE FROM active_job_assignments 
  WHERE job_id = ANY(job_ids) AND job_table_name = 'production_jobs';
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_children_count := deleted_children_count + temp_count;
  
  -- Delete batch job references
  DELETE FROM batch_job_references 
  WHERE production_job_id = ANY(job_ids);
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_children_count := deleted_children_count + temp_count;
  
  -- Finally delete the production jobs themselves
  DELETE FROM production_jobs 
  WHERE id = ANY(job_ids);
  
  GET DIAGNOSTICS deleted_jobs_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_jobs', deleted_jobs_count,
    'deleted_children', deleted_children_count,
    'job_ids', job_ids
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;