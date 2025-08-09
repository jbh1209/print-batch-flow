-- Create function to check if all stages in a dependency group are completed
CREATE OR REPLACE FUNCTION public.check_dependency_completion(
  p_job_id uuid, 
  p_job_table_name text, 
  p_dependency_group uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  total_stages INTEGER;
  completed_stages INTEGER;
BEGIN
  -- If no dependency group specified, consider it completed
  IF p_dependency_group IS NULL THEN
    RETURN true;
  END IF;
  
  -- Count total stages in the dependency group
  SELECT COUNT(*) INTO total_stages
  FROM public.job_stage_instances
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND dependency_group = p_dependency_group;
  
  -- Count completed stages in the dependency group
  SELECT COUNT(*) INTO completed_stages
  FROM public.job_stage_instances
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND dependency_group = p_dependency_group
    AND status = 'completed';
  
  -- Return true only if all stages in the group are completed
  RETURN (total_stages > 0 AND completed_stages = total_stages);
END;
$function$;