-- Function to sync production jobs when batches are completed (REVERSE SYNC)
CREATE OR REPLACE FUNCTION public.sync_production_jobs_from_batch_completion()
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
  -- Loop through each batch job table to find completed batch jobs
  FOREACH table_name IN ARRAY batch_table_names LOOP
    -- Update production jobs to 'Completed' status when their corresponding batch job is completed
    EXECUTE format('
      UPDATE public.production_jobs SET 
        status = ''Completed'',
        updated_at = now()
      FROM public.batch_job_references bjr
      JOIN %I bj ON bjr.batch_job_id = bj.id
      WHERE production_jobs.id = bjr.production_job_id
        AND bjr.batch_job_table = %L
        AND bj.status = ''completed''
        AND production_jobs.status != ''Completed''
    ', table_name, table_name);
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    total_updates := total_updates + update_count;
    
    IF update_count > 0 THEN
      RAISE NOTICE 'Updated % production jobs from completed % batch jobs', update_count, table_name;
    END IF;
  END LOOP;
  
  -- Also update from batches table directly
  UPDATE public.production_jobs 
  SET 
    status = 'Completed',
    updated_at = now()
  FROM public.batch_job_references bjr
  JOIN public.batches b ON bjr.batch_id = b.id
  WHERE production_jobs.id = bjr.production_job_id
    AND b.status = 'completed'
    AND production_jobs.status != 'Completed';
  
  GET DIAGNOSTICS update_count = ROW_COUNT;
  total_updates := total_updates + update_count;
  
  IF update_count > 0 THEN
    RAISE NOTICE 'Updated % production jobs from completed batches', update_count;
  END IF;
  
  RAISE NOTICE 'Total production jobs updated from batch completion: %', total_updates;
  RETURN true;
END;
$$;

-- Trigger function for batch completion reverse sync
CREATE OR REPLACE FUNCTION public.auto_sync_production_jobs_on_batch_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process when batch status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Update related production jobs to completed status
    PERFORM public.sync_production_jobs_from_batch_completion();
    RAISE NOTICE 'Batch % marked as completed - syncing production jobs', NEW.name;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on batches table for reverse sync
DROP TRIGGER IF EXISTS batches_completion_sync ON public.batches;
CREATE TRIGGER batches_completion_sync
  AFTER UPDATE OF status ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_production_jobs_on_batch_completion();

-- Also create triggers on individual batch job tables
DO $$
DECLARE
  table_name text;
  batch_table_names text[] := ARRAY['business_card_jobs', 'flyer_jobs', 'postcard_jobs', 'poster_jobs', 'sticker_jobs', 'cover_jobs', 'sleeve_jobs', 'box_jobs'];
BEGIN
  FOREACH table_name IN ARRAY batch_table_names LOOP
    -- Drop existing trigger if exists
    EXECUTE format('DROP TRIGGER IF EXISTS %I_completion_sync ON public.%I', table_name, table_name);
    
    -- Create trigger for each batch job table
    EXECUTE format('
      CREATE TRIGGER %I_completion_sync
        AFTER UPDATE OF status ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.auto_sync_production_jobs_on_batch_completion()
    ', table_name, table_name);
  END LOOP;
END;
$$;

-- Run initial sync to catch any existing completed batches
SELECT public.sync_production_jobs_from_batch_completion() as reverse_sync_complete;