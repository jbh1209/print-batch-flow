-- Function to create batch master jobs for the "Send to Print" workflow
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
  constituent_job RECORD;
  total_qty integer := 0;
  earliest_due_date date;
  batch_name text;
BEGIN
  -- Get batch details
  SELECT b.name, b.due_date INTO batch_record
  FROM public.batches b
  WHERE b.id = p_batch_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;
  
  -- Calculate aggregate values from constituent jobs
  SELECT 
    SUM(pj.qty),
    MIN(pj.due_date),
    'BATCH-' || batch_record.name || '-' || extract(epoch from now())::text
  INTO total_qty, earliest_due_date, batch_name
  FROM production_jobs pj
  WHERE pj.id = ANY(p_constituent_job_ids);
  
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
    gen_random_uuid(),
    auth.uid(),
    batch_name,
    'BATCH: ' || string_agg(DISTINCT pj.customer, ', '),
    'Batch containing ' || array_length(p_constituent_job_ids, 1) || ' jobs',
    total_qty,
    COALESCE(earliest_due_date, batch_record.due_date::date),
    'Ready to Print',
    TRUE,
    'mixed',
    now(),
    now()
  FROM production_jobs pj
  WHERE pj.id = ANY(p_constituent_job_ids)
  RETURNING id INTO master_job_id;
  
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

-- Function to auto-initialize job stages (simplified version)
CREATE OR REPLACE FUNCTION public.initialize_job_stages_auto(
  p_job_id uuid,
  p_job_table_name text,
  p_category_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_record RECORD;
  first_stage BOOLEAN := TRUE;
BEGIN
  -- For batch master jobs, create a simple printing workflow
  IF p_category_id IS NULL THEN
    -- Get basic printing stages
    FOR stage_record IN
      SELECT id, order_index
      FROM public.production_stages
      WHERE name IN ('DTP', 'Printing', 'Finishing')
        AND is_active = true
      ORDER BY order_index
    LOOP
      INSERT INTO public.job_stage_instances (
        job_id,
        job_table_name,
        production_stage_id,
        stage_order,
        status,
        started_at,
        started_by
      ) VALUES (
        p_job_id,
        p_job_table_name,
        stage_record.id,
        stage_record.order_index,
        CASE WHEN first_stage THEN 'active' ELSE 'pending' END,
        CASE WHEN first_stage THEN now() ELSE NULL END,
        CASE WHEN first_stage THEN auth.uid() ELSE NULL END
      );
      
      first_stage := FALSE;
    END LOOP;
  END IF;
  
  RETURN TRUE;
END;
$$;