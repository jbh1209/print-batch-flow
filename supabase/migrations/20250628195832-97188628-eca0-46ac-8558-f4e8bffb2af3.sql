
-- First, let's create a function to safely check category usage before deletion
CREATE OR REPLACE FUNCTION public.get_category_usage_stats(p_category_id uuid)
RETURNS TABLE(
  production_jobs_count integer,
  job_stage_instances_count integer,
  category_production_stages_count integer,
  can_delete boolean,
  blocking_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  prod_jobs_count integer := 0;
  stage_instances_count integer := 0;
  cat_stages_count integer := 0;
BEGIN
  -- Count production jobs using this category
  SELECT COUNT(*)::integer INTO prod_jobs_count
  FROM public.production_jobs
  WHERE category_id = p_category_id;
  
  -- Count job stage instances using this category
  SELECT COUNT(*)::integer INTO stage_instances_count
  FROM public.job_stage_instances
  WHERE category_id = p_category_id;
  
  -- Count category production stages
  SELECT COUNT(*)::integer INTO cat_stages_count
  FROM public.category_production_stages
  WHERE category_id = p_category_id;
  
  RETURN QUERY SELECT 
    prod_jobs_count,
    stage_instances_count,
    cat_stages_count,
    CASE 
      WHEN prod_jobs_count = 0 AND stage_instances_count = 0 THEN true
      ELSE false
    END as can_delete,
    CASE 
      WHEN prod_jobs_count > 0 THEN format('Category is used by %s production job(s)', prod_jobs_count)
      WHEN stage_instances_count > 0 THEN format('Category has %s active workflow stage(s)', stage_instances_count)
      ELSE 'Category can be safely deleted'
    END as blocking_reason;
END;
$function$;

-- Create a function to reassign jobs from one category to another
CREATE OR REPLACE FUNCTION public.reassign_jobs_to_category(
  p_from_category_id uuid,
  p_to_category_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  jobs_reassigned integer,
  stages_updated integer,
  success boolean,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  jobs_count integer := 0;
  stages_count integer := 0;
  error_msg text := '';
BEGIN
  -- Check if both categories exist
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_from_category_id) THEN
    RETURN QUERY SELECT 0, 0, false, 'Source category does not exist';
    RETURN;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_to_category_id) THEN
    RETURN QUERY SELECT 0, 0, false, 'Target category does not exist';
    RETURN;
  END IF;
  
  BEGIN
    -- Update production jobs
    UPDATE public.production_jobs
    SET category_id = p_to_category_id, updated_at = now()
    WHERE category_id = p_from_category_id;
    
    GET DIAGNOSTICS jobs_count = ROW_COUNT;
    
    -- Update job stage instances
    UPDATE public.job_stage_instances
    SET category_id = p_to_category_id, updated_at = now()
    WHERE category_id = p_from_category_id;
    
    GET DIAGNOSTICS stages_count = ROW_COUNT;
    
    RETURN QUERY SELECT jobs_count, stages_count, true, 'Jobs reassigned successfully'::text;
    
  EXCEPTION WHEN OTHERS THEN
    error_msg := SQLERRM;
    RETURN QUERY SELECT 0, 0, false, error_msg;
  END;
END;
$function$;

-- Create a function to safely delete a category after cleanup
CREATE OR REPLACE FUNCTION public.safe_delete_category(
  p_category_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  success boolean,
  message text,
  deleted_stages integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  usage_stats RECORD;
  stages_deleted integer := 0;
BEGIN
  -- Check usage stats first
  SELECT * INTO usage_stats
  FROM public.get_category_usage_stats(p_category_id);
  
  IF NOT usage_stats.can_delete THEN
    RETURN QUERY SELECT false, usage_stats.blocking_reason, 0;
    RETURN;
  END IF;
  
  BEGIN
    -- Delete category production stages first
    DELETE FROM public.category_production_stages
    WHERE category_id = p_category_id;
    
    GET DIAGNOSTICS stages_deleted = ROW_COUNT;
    
    -- Delete the category itself
    DELETE FROM public.categories
    WHERE id = p_category_id;
    
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 'Category not found'::text, stages_deleted;
      RETURN;
    END IF;
    
    RETURN QUERY SELECT true, 'Category deleted successfully'::text, stages_deleted;
    
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM, 0;
  END;
END;
$function$;
