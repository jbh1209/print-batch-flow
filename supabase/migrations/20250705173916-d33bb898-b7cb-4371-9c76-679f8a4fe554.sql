-- BATCHFLOW-TRACKER INTEGRATION: Phase 1 & 3 Implementation
-- Enhanced master job creation and automatic job splitting functionality

-- 1. Create comprehensive batch master job creation function
CREATE OR REPLACE FUNCTION public.create_enhanced_batch_master_job(
  p_batch_id uuid,
  p_created_by uuid DEFAULT auth.uid()
)
RETURNS TABLE(master_job_id uuid, printing_stage_id uuid, constituent_jobs_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  batch_record RECORD;
  constituent_jobs RECORD[];
  master_job_id uuid;
  printing_stage_id uuid;
  category_colors text[];
  dominant_category_id uuid;
  stage_order_num integer;
  jobs_count integer := 0;
BEGIN
  -- Get batch details
  SELECT b.id, b.name, b.status INTO batch_record
  FROM public.batches b
  WHERE b.id = p_batch_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;
  
  -- Get constituent jobs with their categories and specifications
  SELECT 
    array_agg(
      ROW(pj.id, pj.wo_no, pj.customer, pj.qty, pj.due_date, pj.category_id, c.name, c.color)::text
    ),
    array_agg(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL),
    array_agg(DISTINCT c.color) FILTER (WHERE c.color IS NOT NULL),
    count(*)::integer
  INTO constituent_jobs, category_colors, category_colors, jobs_count
  FROM public.batch_job_references bjr
  JOIN public.production_jobs pj ON bjr.production_job_id = pj.id
  LEFT JOIN public.categories c ON pj.category_id = c.id
  WHERE bjr.batch_id = p_batch_id;
  
  IF jobs_count = 0 THEN
    RAISE EXCEPTION 'No constituent jobs found for batch %', p_batch_id;
  END IF;
  
  -- Determine dominant category (most common category among constituent jobs)
  SELECT c.id INTO dominant_category_id
  FROM public.batch_job_references bjr
  JOIN public.production_jobs pj ON bjr.production_job_id = pj.id
  JOIN public.categories c ON pj.category_id = c.id
  WHERE bjr.batch_id = p_batch_id
  GROUP BY c.id
  ORDER BY COUNT(*) DESC
  LIMIT 1;
  
  -- Find appropriate printing stage from dominant category
  SELECT 
    cps.production_stage_id,
    cps.stage_order
  INTO printing_stage_id, stage_order_num
  FROM public.category_production_stages cps
  JOIN public.production_stages ps ON cps.production_stage_id = ps.id
  WHERE cps.category_id = dominant_category_id
    AND ps.name ILIKE '%print%'
  ORDER BY cps.stage_order ASC
  LIMIT 1;
  
  IF printing_stage_id IS NULL THEN
    -- Fallback: find any active printing stage
    SELECT id INTO printing_stage_id
    FROM public.production_stages
    WHERE name ILIKE '%print%' AND is_active = true
    ORDER BY name
    LIMIT 1;
    
    stage_order_num := 10; -- Default order
  END IF;
  
  IF printing_stage_id IS NULL THEN
    RAISE EXCEPTION 'No printing stage found for batch processing';
  END IF;
  
  -- Create master job in production_jobs
  INSERT INTO public.production_jobs (
    id,
    user_id,
    wo_no,
    status,
    customer,
    reference,
    qty,
    due_date,
    category_id,
    batch_category,
    is_batch_master,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_created_by,
    'BATCH-' || batch_record.name,
    'In Production',
    'Batch Processing',
    'Master job for batch: ' || batch_record.name,
    jobs_count,
    (
      SELECT MIN(pj.due_date)
      FROM public.batch_job_references bjr
      JOIN public.production_jobs pj ON bjr.production_job_id = pj.id
      WHERE bjr.batch_id = p_batch_id
    ),
    dominant_category_id,
    'batch_processing',
    true,
    now(),
    now()
  ) RETURNING id INTO master_job_id;
  
  -- Initialize master job with printing stage workflow
  INSERT INTO public.job_stage_instances (
    job_id,
    job_table_name,
    category_id,
    production_stage_id,
    stage_order,
    status,
    started_at,
    started_by
  ) VALUES (
    master_job_id,
    'production_jobs',
    dominant_category_id,
    printing_stage_id,
    stage_order_num,
    'active', -- Start immediately in printing
    now(),
    p_created_by
  );
  
  -- Update constituent jobs to "In Batch Processing" status
  UPDATE public.production_jobs
  SET 
    status = 'In Batch Processing',
    updated_at = now()
  WHERE id IN (
    SELECT bjr.production_job_id
    FROM public.batch_job_references bjr
    WHERE bjr.batch_id = p_batch_id
  );
  
  -- Update batch status to 'in_production'
  UPDATE public.batches
  SET 
    status = 'in_production',
    updated_at = now()
  WHERE id = p_batch_id;
  
  RETURN QUERY SELECT master_job_id, printing_stage_id, jobs_count;
END;
$function$;

-- 2. Create automatic job splitting function for packaging stage
CREATE OR REPLACE FUNCTION public.split_batch_at_packaging(
  p_master_job_id uuid,
  p_split_by uuid DEFAULT auth.uid()
)
RETURNS TABLE(split_jobs_count integer, batch_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  master_job RECORD;
  batch_record RECORD;
  constituent_job RECORD;
  packaging_stage_id uuid;
  jobs_split integer := 0;
  batch_id_result uuid;
BEGIN
  -- Get master job details
  SELECT pj.id, pj.wo_no, pj.batch_category
  INTO master_job
  FROM public.production_jobs pj
  WHERE pj.id = p_master_job_id AND pj.is_batch_master = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Master job % not found or not a batch master', p_master_job_id;
  END IF;
  
  -- Find the batch ID
  SELECT b.id INTO batch_id_result
  FROM public.batches b
  WHERE b.name = REPLACE(master_job.wo_no, 'BATCH-', '');
  
  -- Find packaging stage
  SELECT id INTO packaging_stage_id
  FROM public.production_stages
  WHERE name ILIKE '%packaging%' AND is_active = true
  LIMIT 1;
  
  IF packaging_stage_id IS NULL THEN
    RAISE EXCEPTION 'Packaging stage not found';
  END IF;
  
  -- Split out constituent jobs and initialize them at packaging stage
  FOR constituent_job IN
    SELECT pj.id, pj.category_id
    FROM public.batch_job_references bjr
    JOIN public.production_jobs pj ON bjr.production_job_id = pj.id
    WHERE bjr.batch_id = batch_id_result
  LOOP
    -- Update constituent job status back to active workflow
    UPDATE public.production_jobs
    SET 
      status = 'Packaging',
      updated_at = now()
    WHERE id = constituent_job.id;
    
    -- Initialize packaging stage for constituent job
    INSERT INTO public.job_stage_instances (
      job_id,
      job_table_name,
      category_id,
      production_stage_id,
      stage_order,
      status,
      started_at,
      started_by
    ) VALUES (
      constituent_job.id,
      'production_jobs',
      constituent_job.category_id,
      packaging_stage_id,
      100, -- High order for packaging
      'active',
      now(),
      p_split_by
    );
    
    jobs_split := jobs_split + 1;
  END LOOP;
  
  -- Complete and archive the master job
  UPDATE public.production_jobs
  SET 
    status = 'Completed',
    updated_at = now()
  WHERE id = p_master_job_id;
  
  -- Mark all master job stages as completed
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = p_split_by,
    updated_at = now()
  WHERE job_id = p_master_job_id;
  
  -- Update batch status to completed
  UPDATE public.batches
  SET 
    status = 'completed',
    updated_at = now()
  WHERE id = batch_id_result;
  
  RETURN QUERY SELECT jobs_split, batch_id_result;
END;
$function$;

-- 3. Create trigger to automatically split batches at packaging stage
CREATE OR REPLACE FUNCTION public.auto_split_batch_at_packaging()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  packaging_stage_id uuid;
  split_result RECORD;
BEGIN
  -- Only process if this is a batch master job reaching packaging stage
  IF NEW.status = 'active' AND OLD.status = 'pending' THEN
    -- Check if this stage is packaging and job is batch master
    SELECT ps.id INTO packaging_stage_id
    FROM public.production_stages ps
    WHERE ps.id = NEW.production_stage_id
      AND ps.name ILIKE '%packaging%';
    
    IF packaging_stage_id IS NOT NULL THEN
      -- Check if the job is a batch master
      IF EXISTS (
        SELECT 1 FROM public.production_jobs pj
        WHERE pj.id = NEW.job_id AND pj.is_batch_master = true
      ) THEN
        -- Split the batch automatically
        SELECT * INTO split_result
        FROM public.split_batch_at_packaging(NEW.job_id, NEW.started_by);
        
        RAISE NOTICE 'Auto-split batch master job % - split % constituent jobs', 
          NEW.job_id, split_result.split_jobs_count;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_split_batch_trigger ON job_stage_instances;
CREATE TRIGGER auto_split_batch_trigger
  AFTER UPDATE ON job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION auto_split_batch_at_packaging();

-- 4. Enhanced batch validation function
CREATE OR REPLACE FUNCTION public.validate_batch_simple(p_batch_id uuid)
RETURNS TABLE(is_valid boolean, reference_count integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  batch_exists boolean;
  ref_count integer;
  validation_message text;
BEGIN
  -- Check if batch exists
  SELECT EXISTS (
    SELECT 1 FROM public.batches WHERE id = p_batch_id
  ) INTO batch_exists;
  
  IF NOT batch_exists THEN
    RETURN QUERY SELECT false, 0, 'Batch does not exist';
    RETURN;
  END IF;
  
  -- Count references
  SELECT COUNT(*) INTO ref_count
  FROM public.batch_job_references
  WHERE batch_id = p_batch_id;
  
  IF ref_count = 0 THEN
    validation_message := 'Batch has no job references';
    RETURN QUERY SELECT false, ref_count, validation_message;
  ELSE
    validation_message := format('Batch is valid with %s job references', ref_count);
    RETURN QUERY SELECT true, ref_count, validation_message;
  END IF;
END;
$function$;