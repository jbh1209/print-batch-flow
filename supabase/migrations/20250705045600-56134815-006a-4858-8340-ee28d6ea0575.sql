-- Function to sync completed production jobs with batch jobs
CREATE OR REPLACE FUNCTION public.sync_completed_jobs_with_batch_flow()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_table_names text[] := ARRAY['business_card_jobs', 'flyer_jobs', 'postcard_jobs', 'poster_jobs', 'sticker_jobs', 'cover_jobs', 'sleeve_jobs', 'box_jobs'];
  table_name text;
  update_count integer := 0;
  total_updates integer := 0;
BEGIN
  -- Loop through each batch job table
  FOREACH table_name IN ARRAY batch_table_names LOOP
    -- Update batch jobs to 'completed' status when their corresponding production job is completed
    EXECUTE format('
      UPDATE %I SET 
        status = ''completed'',
        updated_at = now()
      FROM public.batch_job_references bjr
      JOIN public.production_jobs pj ON bjr.production_job_id = pj.id
      WHERE %I.id = bjr.batch_job_id
        AND bjr.batch_job_table = %L
        AND pj.status = ''Completed''
        AND %I.status != ''completed''
    ', table_name, table_name, table_name, table_name);
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    total_updates := total_updates + update_count;
    
    IF update_count > 0 THEN
      RAISE NOTICE 'Updated % completed jobs in %', update_count, table_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total batch jobs synchronized: %', total_updates;
  RETURN true;
END;
$$;

-- Function to clean up corrupted batch job names and numbers
CREATE OR REPLACE FUNCTION public.cleanup_corrupted_batch_jobs()
RETURNS TABLE(table_name text, fixed_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_table_names text[] := ARRAY['business_card_jobs', 'flyer_jobs', 'postcard_jobs', 'poster_jobs', 'sticker_jobs', 'cover_jobs', 'sleeve_jobs', 'box_jobs'];
  current_table text;
  fix_count integer := 0;
BEGIN
  -- Loop through each batch job table
  FOREACH current_table IN ARRAY batch_table_names LOOP
    -- Fix job numbers that have BATCH- prefix and timestamps
    EXECUTE format('
      UPDATE %I SET 
        job_number = REGEXP_REPLACE(job_number, ''^BATCH-(.+?)-\d+$'', ''\1''),
        updated_at = now()
      WHERE job_number ~ ''^BATCH-.+-\d+$''
    ', current_table);
    
    GET DIAGNOSTICS fix_count = ROW_COUNT;
    
    -- Update names from generic "Batch Job - XXX" to actual customer names from production jobs
    EXECUTE format('
      UPDATE %I SET 
        name = pj.customer,
        updated_at = now()
      FROM public.batch_job_references bjr
      JOIN public.production_jobs pj ON bjr.production_job_id = pj.id
      WHERE %I.id = bjr.batch_job_id
        AND bjr.batch_job_table = %L
        AND %I.name LIKE ''Batch Job - %%''
        AND pj.customer IS NOT NULL
        AND pj.customer != ''''
    ', current_table, current_table, current_table, current_table);
    
    GET DIAGNOSTICS fix_count = fix_count + ROW_COUNT;
    
    RETURN QUERY SELECT current_table, fix_count;
  END LOOP;
END;
$$;

-- Trigger function to automatically sync batch job status when production job is completed
CREATE OR REPLACE FUNCTION public.auto_sync_batch_job_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process when status changes to 'Completed'
  IF NEW.status = 'Completed' AND (OLD.status IS NULL OR OLD.status != 'Completed') THEN
    -- Update related batch jobs to completed status
    PERFORM public.sync_completed_jobs_with_batch_flow();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on production_jobs table
DROP TRIGGER IF EXISTS production_jobs_status_sync ON public.production_jobs;
CREATE TRIGGER production_jobs_status_sync
  AFTER UPDATE OF status ON public.production_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_batch_job_status();

-- Run initial cleanup and sync
SELECT public.cleanup_corrupted_batch_jobs();
SELECT public.sync_completed_jobs_with_batch_flow();