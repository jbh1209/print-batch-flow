-- Fix RLS policies for batch_job_references table
-- This table needs proper access control for authenticated users

-- Enable RLS if not already enabled
ALTER TABLE public.batch_job_references ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to view batch references" ON public.batch_job_references;
DROP POLICY IF EXISTS "Allow authenticated users to manage batch references" ON public.batch_job_references;

-- Create comprehensive RLS policies for batch_job_references
CREATE POLICY "Allow authenticated users to view batch references" 
ON public.batch_job_references 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert batch references" 
ON public.batch_job_references 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update batch references" 
ON public.batch_job_references 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete batch references" 
ON public.batch_job_references 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create comprehensive batch data integrity validation function
CREATE OR REPLACE FUNCTION public.validate_batch_integrity(p_batch_id uuid)
RETURNS TABLE(
  is_valid boolean,
  error_count integer,
  missing_references integer,
  orphaned_jobs integer,
  issues jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  validation_issues jsonb := '[]'::jsonb;
  error_count integer := 0;
  missing_refs integer := 0;
  orphaned_count integer := 0;
BEGIN
  -- Check if batch exists
  IF NOT EXISTS (SELECT 1 FROM public.batches WHERE id = p_batch_id) THEN
    validation_issues := validation_issues || jsonb_build_object('type', 'missing_batch', 'message', 'Batch does not exist');
    error_count := error_count + 1;
  END IF;
  
  -- Check for missing batch job references
  SELECT COUNT(*) INTO missing_refs
  FROM public.production_jobs pj
  WHERE pj.batch_ready = true
    AND NOT EXISTS (
      SELECT 1 FROM public.batch_job_references bjr 
      WHERE bjr.production_job_id = pj.id
    );
    
  IF missing_refs > 0 THEN
    validation_issues := validation_issues || jsonb_build_object(
      'type', 'missing_references', 
      'count', missing_refs,
      'message', format('%s production jobs are batch ready but have no references', missing_refs)
    );
    error_count := error_count + 1;
  END IF;
  
  -- Check for orphaned batch references
  SELECT COUNT(*) INTO orphaned_count
  FROM public.batch_job_references bjr
  WHERE bjr.batch_id = p_batch_id
    AND NOT EXISTS (
      SELECT 1 FROM public.production_jobs pj 
      WHERE pj.id = bjr.production_job_id
    );
    
  IF orphaned_count > 0 THEN
    validation_issues := validation_issues || jsonb_build_object(
      'type', 'orphaned_references', 
      'count', orphaned_count,
      'message', format('%s batch references point to non-existent production jobs', orphaned_count)
    );
    error_count := error_count + 1;
  END IF;
  
  RETURN QUERY SELECT 
    error_count = 0,
    error_count,
    missing_refs,
    orphaned_count,
    validation_issues;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.validate_batch_integrity(uuid) TO authenticated;