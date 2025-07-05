-- Function to repair missing batch job references
CREATE OR REPLACE FUNCTION public.repair_missing_batch_references()
RETURNS TABLE(batch_id uuid, batch_name text, references_created integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_table_names text[] := ARRAY['business_card_jobs', 'flyer_jobs', 'postcard_jobs', 'poster_jobs', 'sticker_jobs', 'cover_jobs', 'sleeve_jobs', 'box_jobs'];
  table_name text;
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
    created_count := 0;
    
    -- Check each job table for jobs linked to this batch
    FOREACH table_name IN ARRAY batch_table_names LOOP
      -- Create missing references for jobs that have batch_id but no reference entry
      EXECUTE format('
        INSERT INTO public.batch_job_references (
          batch_id,
          batch_job_id,
          batch_job_table,
          production_job_id,
          status
        )
        SELECT 
          %L::uuid as batch_id,
          bj.id as batch_job_id,
          %L as batch_job_table,
          bj.id as production_job_id,
          ''pending'' as status
        FROM %I bj
        LEFT JOIN public.batch_job_references bjr ON (
          bjr.batch_job_id = bj.id 
          AND bjr.batch_job_table = %L
        )
        WHERE bj.batch_id = %L::uuid
          AND bjr.id IS NULL
      ', batch_record.id, table_name, table_name, table_name, batch_record.id);
      
      GET DIAGNOSTICS created_count = ROW_COUNT;
      total_created := total_created + created_count;
    END LOOP;
    
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

-- Run the repair function to fix existing data
SELECT * FROM public.repair_missing_batch_references();