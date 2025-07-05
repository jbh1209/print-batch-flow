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
    
    -- Handle other job types similarly (postcard_jobs, poster_jobs, etc.)
    INSERT INTO public.batch_job_references (
      batch_id,
      batch_job_id,
      batch_job_table,
      production_job_id,
      status
    )
    SELECT 
      batch_record.id as batch_id,
      pj_table.id as batch_job_id,
      pj_table.table_name as batch_job_table,
      pj.id as production_job_id,
      'pending' as status
    FROM (
      SELECT id, job_number, batch_id, 'postcard_jobs' as table_name FROM postcard_jobs WHERE batch_id = batch_record.id
      UNION ALL
      SELECT id, job_number, batch_id, 'poster_jobs' as table_name FROM poster_jobs WHERE batch_id = batch_record.id
      UNION ALL
      SELECT id, job_number, batch_id, 'sticker_jobs' as table_name FROM sticker_jobs WHERE batch_id = batch_record.id
      UNION ALL
      SELECT id, job_number, batch_id, 'cover_jobs' as table_name FROM cover_jobs WHERE batch_id = batch_record.id
      UNION ALL
      SELECT id, job_number, batch_id, 'sleeve_jobs' as table_name FROM sleeve_jobs WHERE batch_id = batch_record.id
      UNION ALL
      SELECT id, job_number, batch_id, 'box_jobs' as table_name FROM box_jobs WHERE batch_id = batch_record.id
    ) pj_table
    JOIN production_jobs pj ON pj_table.job_number = pj.wo_no
    LEFT JOIN public.batch_job_references bjr ON (
      bjr.batch_job_id = pj_table.id 
      AND bjr.batch_job_table = pj_table.table_name
    )
    WHERE bjr.id IS NULL;
    
    GET DIAGNOSTICS created_count = ROW_COUNT;
    total_created := total_created + created_count;
    
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