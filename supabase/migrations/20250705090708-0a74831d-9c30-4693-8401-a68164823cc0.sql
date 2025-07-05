-- Comprehensive Fix for Send to Print Function Overloading Issue
-- Step 1: Drop all existing versions of create_batch_master_job to eliminate ambiguity

DROP FUNCTION IF EXISTS public.create_batch_master_job(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.create_batch_master_job(uuid, text[]);
DROP FUNCTION IF EXISTS public.create_batch_master_job(uuid, uuid[], text);

-- Step 2: Create a single, definitive version of create_batch_master_job
CREATE OR REPLACE FUNCTION public.create_batch_master_job(
  p_batch_id uuid,
  p_constituent_job_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_job_id uuid;
  batch_record RECORD;
  total_qty integer := 0;
  earliest_due_date date;
  batch_name text;
  constituent_jobs_count integer;
BEGIN
  -- Validate inputs
  IF p_batch_id IS NULL THEN
    RAISE EXCEPTION 'Batch ID cannot be null';
  END IF;
  
  IF p_constituent_job_ids IS NULL OR array_length(p_constituent_job_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Constituent job IDs array cannot be null or empty';
  END IF;

  -- Get batch details
  SELECT b.name, b.due_date INTO batch_record
  FROM public.batches b
  WHERE b.id = p_batch_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;

  -- Validate that all constituent jobs exist
  SELECT COUNT(*) INTO constituent_jobs_count
  FROM public.production_jobs pj
  WHERE pj.id = ANY(p_constituent_job_ids);
  
  IF constituent_jobs_count != array_length(p_constituent_job_ids, 1) THEN
    RAISE EXCEPTION 'Not all constituent jobs found. Expected %, found %', 
      array_length(p_constituent_job_ids, 1), constituent_jobs_count;
  END IF;

  -- Calculate aggregate values from constituent jobs
  SELECT 
    COALESCE(SUM(pj.qty), 0),
    MIN(pj.due_date),
    'BATCH-' || batch_record.name || '-' || to_char(now(), 'YYYYMMDDHH24MISS')
  INTO total_qty, earliest_due_date, batch_name
  FROM public.production_jobs pj
  WHERE pj.id = ANY(p_constituent_job_ids);

  -- Generate unique master job ID
  master_job_id := gen_random_uuid();

  -- Create the batch master job
  INSERT INTO public.production_jobs (
    id,
    user_id,
    wo_no,
    customer,
    reference,
    qty,
    due_date,
    status,
    is_batch_master,
    batch_category,
    created_at,
    updated_at
  )
  SELECT 
    master_job_id,
    auth.uid(),
    batch_name,
    'BATCH: ' || string_agg(DISTINCT COALESCE(pj.customer, 'Unknown'), ', '),
    'Batch containing ' || array_length(p_constituent_job_ids, 1) || ' jobs',
    total_qty,
    COALESCE(earliest_due_date, batch_record.due_date::date),
    'Ready to Print',
    TRUE,
    'mixed',
    now(),
    now()
  FROM public.production_jobs pj
  WHERE pj.id = ANY(p_constituent_job_ids);

  -- Log the creation
  RAISE NOTICE 'Created batch master job % for batch % with % constituent jobs', 
    master_job_id, p_batch_id, array_length(p_constituent_job_ids, 1);

  -- Update constituent jobs to reference the master
  UPDATE public.production_jobs
  SET 
    status = 'In Batch Processing',
    batch_ready = true,
    updated_at = now()
  WHERE id = ANY(p_constituent_job_ids);

  -- Initialize workflow stages for the master job
  PERFORM public.initialize_job_stages_auto(master_job_id, 'production_jobs', null);

  RETURN master_job_id;
END;
$$;

-- Step 3: Create reverse sync function for production jobs
CREATE OR REPLACE FUNCTION public.sync_production_jobs_from_batch_completion()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sync_count integer := 0;
BEGIN
  -- Update production jobs based on completed batch references
  UPDATE public.production_jobs pj
  SET 
    status = 'Batch Complete',
    batch_ready = false,
    updated_at = now()
  FROM public.batch_job_references bjr
  WHERE bjr.production_job_id = pj.id
    AND bjr.status = 'completed'
    AND pj.status = 'In Batch Processing';
    
  GET DIAGNOSTICS sync_count = ROW_COUNT;
  
  RAISE NOTICE 'Synced % production jobs from batch completion', sync_count;
  
  RETURN TRUE;
END;
$$;

-- Step 4: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_batch_master_job(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_production_jobs_from_batch_completion() TO authenticated;