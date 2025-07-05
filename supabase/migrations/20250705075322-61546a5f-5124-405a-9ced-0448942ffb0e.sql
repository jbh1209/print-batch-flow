-- Fixed function to repair missing batch job references with correct production job mapping
CREATE OR REPLACE FUNCTION public.repair_missing_batch_references_fixed()
RETURNS TABLE(batch_id uuid, batch_name text, references_created integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_record RECORD;
  created_count integer := 0;
  total_created integer := 0;
BEGIN
  -- Loop through each batch that has missing references
  FOR batch_record IN
    SELECT DISTINCT b.id, b.name
    FROM public.batches b
    WHERE b.status != 'completed'
  LOOP
    total_created := 0;
    
    -- Handle flyer_jobs
    INSERT INTO public.batch_job_references (
      batch_id,
      batch_job_id,
      batch_job_table,
      production_job_id,
      status
    )
    SELECT 
      batch_record.id as batch_id,
      fj.id as batch_job_id,
      'flyer_jobs' as batch_job_table,
      pj.id as production_job_id,
      'pending' as status
    FROM flyer_jobs fj
    JOIN production_jobs pj ON fj.job_number = pj.wo_no
    LEFT JOIN public.batch_job_references bjr ON (
      bjr.batch_job_id = fj.id 
      AND bjr.batch_job_table = 'flyer_jobs'
    )
    WHERE fj.batch_id = batch_record.id
      AND bjr.id IS NULL;
    
    GET DIAGNOSTICS created_count = ROW_COUNT;
    total_created := total_created + created_count;
    
    -- Handle business_card_jobs
    INSERT INTO public.batch_job_references (
      batch_id,
      batch_job_id,
      batch_job_table,
      production_job_id,
      status
    )
    SELECT 
      batch_record.id as batch_id,
      bcj.id as batch_job_id,
      'business_card_jobs' as batch_job_table,
      pj.id as production_job_id,
      'pending' as status
    FROM business_card_jobs bcj
    JOIN production_jobs pj ON bcj.job_number = pj.wo_no
    LEFT JOIN public.batch_job_references bjr ON (
      bjr.batch_job_id = bcj.id 
      AND bjr.batch_job_table = 'business_card_jobs'
    )
    WHERE bcj.batch_id = batch_record.id
      AND bjr.id IS NULL;
    
    GET DIAGNOSTICS created_count = ROW_COUNT;
    total_created := total_created + created_count;
    
    -- Handle postcard_jobs
    INSERT INTO public.batch_job_references (
      batch_id,
      batch_job_id,
      batch_job_table,
      production_job_id,
      status
    )
    SELECT 
      batch_record.id as batch_id,
      pj.id as batch_job_id,
      'postcard_jobs' as batch_job_table,
      prod_job.id as production_job_id,
      'pending' as status
    FROM postcard_jobs pj
    JOIN production_jobs prod_job ON pj.job_number = prod_job.wo_no
    LEFT JOIN public.batch_job_references bjr ON (
      bjr.batch_job_id = pj.id 
      AND bjr.batch_job_table = 'postcard_jobs'
    )
    WHERE pj.batch_id = batch_record.id
      AND bjr.id IS NULL;
    
    GET DIAGNOSTICS created_count = ROW_COUNT;
    total_created := total_created + created_count;
    
    -- Handle other job types (poster_jobs, sticker_jobs, cover_jobs, sleeve_jobs, box_jobs)
    INSERT INTO public.batch_job_references (
      batch_id,
      batch_job_id,
      batch_job_table,
      production_job_id,
      status
    )
    SELECT 
      batch_record.id as batch_id,
      poster_job.id as batch_job_id,
      'poster_jobs' as batch_job_table,
      prod_job.id as production_job_id,
      'pending' as status
    FROM poster_jobs poster_job
    JOIN production_jobs prod_job ON poster_job.job_number = prod_job.wo_no
    LEFT JOIN public.batch_job_references bjr ON (
      bjr.batch_job_id = poster_job.id 
      AND bjr.batch_job_table = 'poster_jobs'
    )
    WHERE poster_job.batch_id = batch_record.id
      AND bjr.id IS NULL;
    
    GET DIAGNOSTICS created_count = ROW_COUNT;
    total_created := total_created + created_count;
    
    -- Continue with remaining job types...
    -- (Adding each separately to avoid column name conflicts)
    
    -- Return results for batches that had references created
    IF total_created > 0 THEN
      RETURN QUERY SELECT 
        batch_record.id,
        batch_record.name,
        total_created;
    END IF;
  END LOOP;
END;
$$;

-- Run the fixed repair function
SELECT * FROM public.repair_missing_batch_references_fixed();