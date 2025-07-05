-- Fix batch status in enhanced master job creation function
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
  master_job_id uuid;
  printing_stage_id uuid;
  dominant_category_id uuid;
  stage_order_num integer;
  jobs_count integer := 0;
  earliest_due_date date;
BEGIN
  -- Get batch details
  SELECT b.id, b.name, b.status INTO batch_record
  FROM public.batches b
  WHERE b.id = p_batch_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;
  
  -- Get constituent jobs count and earliest due date
  SELECT 
    count(*)::integer,
    MIN(pj.due_date)
  INTO jobs_count, earliest_due_date
  FROM public.batch_job_references bjr
  JOIN public.production_jobs pj ON bjr.production_job_id = pj.id
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
    earliest_due_date,
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
  
  -- Update batch status to 'sent_to_print' (valid enum value)
  UPDATE public.batches
  SET 
    status = 'sent_to_print',
    updated_at = now()
  WHERE id = p_batch_id;
  
  RETURN QUERY SELECT master_job_id, printing_stage_id, jobs_count;
END;
$function$;