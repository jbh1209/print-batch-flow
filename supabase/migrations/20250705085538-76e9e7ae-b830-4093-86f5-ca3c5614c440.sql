-- Comprehensive Batch Job References Fix
-- This migration creates automatic triggers and functions to ensure batch_job_references are always created

-- Function to automatically create batch job references when jobs are assigned to batches
CREATE OR REPLACE FUNCTION public.auto_create_batch_job_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_table_name text;
BEGIN
  -- Determine the table name based on the trigger source
  batch_table_name := TG_TABLE_NAME;
  
  -- Only create reference if batch_id is being set (not null)
  IF NEW.batch_id IS NOT NULL AND (OLD.batch_id IS NULL OR OLD.batch_id != NEW.batch_id) THEN
    -- Find the corresponding production job by job_number
    INSERT INTO public.batch_job_references (
      batch_id,
      batch_job_id,
      batch_job_table,
      production_job_id,
      status,
      created_at
    )
    SELECT 
      NEW.batch_id,
      NEW.id,
      batch_table_name,
      pj.id,
      'pending',
      now()
    FROM public.production_jobs pj
    WHERE pj.wo_no = NEW.job_number
    ON CONFLICT (batch_id, batch_job_id, batch_job_table) DO NOTHING;
    
    RAISE NOTICE 'Created batch job reference for % job % in batch %', batch_table_name, NEW.job_number, NEW.batch_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for all job tables to automatically create batch references
DO $$
DECLARE
  job_table text;
  job_tables text[] := ARRAY['business_card_jobs', 'flyer_jobs', 'postcard_jobs', 'poster_jobs', 'sticker_jobs', 'cover_jobs', 'sleeve_jobs', 'box_jobs'];
BEGIN
  FOREACH job_table IN ARRAY job_tables LOOP
    -- Drop existing trigger if it exists
    EXECUTE format('DROP TRIGGER IF EXISTS auto_batch_references_%s ON public.%I', job_table, job_table);
    
    -- Create new trigger
    EXECUTE format('
      CREATE TRIGGER auto_batch_references_%s
        AFTER INSERT OR UPDATE OF batch_id ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.auto_create_batch_job_references()
    ', job_table, job_table);
    
    RAISE NOTICE 'Created auto batch references trigger for %', job_table;
  END LOOP;
END;
$$;

-- Function to validate batch integrity and create missing references
CREATE OR REPLACE FUNCTION public.validate_and_repair_batch_references(p_batch_id uuid DEFAULT NULL)
RETURNS TABLE(batch_id uuid, batch_name text, missing_references integer, created_references integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_record RECORD;
  job_table text;
  job_tables text[] := ARRAY['business_card_jobs', 'flyer_jobs', 'postcard_jobs', 'poster_jobs', 'sticker_jobs', 'cover_jobs', 'sleeve_jobs', 'box_jobs'];
  missing_count integer;
  created_count integer;
  total_missing integer := 0;
  total_created integer := 0;
BEGIN
  -- If specific batch ID provided, validate just that batch
  IF p_batch_id IS NOT NULL THEN
    SELECT b.id, b.name INTO batch_record FROM public.batches b WHERE b.id = p_batch_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Batch with ID % not found', p_batch_id;
    END IF;
    
    -- Process each job table for this specific batch
    FOREACH job_table IN ARRAY job_tables LOOP
      EXECUTE format('
        WITH missing_refs AS (
          SELECT 
            j.id as job_id,
            j.job_number,
            pj.id as production_job_id
          FROM %I j
          JOIN public.production_jobs pj ON j.job_number = pj.wo_no
          LEFT JOIN public.batch_job_references bjr ON (
            bjr.batch_job_id = j.id 
            AND bjr.batch_job_table = %L
            AND bjr.batch_id = j.batch_id
          )
          WHERE j.batch_id = $1 AND bjr.id IS NULL
        ),
        inserted_refs AS (
          INSERT INTO public.batch_job_references (
            batch_id, batch_job_id, batch_job_table, production_job_id, status
          )
          SELECT $1, mr.job_id, %L, mr.production_job_id, ''pending''
          FROM missing_refs mr
          RETURNING 1
        )
        SELECT 
          (SELECT COUNT(*) FROM missing_refs) as missing,
          (SELECT COUNT(*) FROM inserted_refs) as created
      ', job_table, job_table, job_table) 
      USING p_batch_id
      INTO missing_count, created_count;
      
      total_missing := total_missing + missing_count;
      total_created := total_created + created_count;
    END LOOP;
    
    RETURN QUERY SELECT batch_record.id, batch_record.name, total_missing, total_created;
  ELSE
    -- Process all batches if no specific ID provided
    FOR batch_record IN
      SELECT b.id, b.name FROM public.batches b WHERE b.status != 'completed'
    LOOP
      total_missing := 0;
      total_created := 0;
      
      FOREACH job_table IN ARRAY job_tables LOOP
        EXECUTE format('
          WITH missing_refs AS (
            SELECT 
              j.id as job_id,
              j.job_number,
              pj.id as production_job_id
            FROM %I j
            JOIN public.production_jobs pj ON j.job_number = pj.wo_no
            LEFT JOIN public.batch_job_references bjr ON (
              bjr.batch_job_id = j.id 
              AND bjr.batch_job_table = %L
              AND bjr.batch_id = j.batch_id
            )
            WHERE j.batch_id = $1 AND bjr.id IS NULL
          ),
          inserted_refs AS (
            INSERT INTO public.batch_job_references (
              batch_id, batch_job_id, batch_job_table, production_job_id, status
            )
            SELECT $1, mr.job_id, %L, mr.production_job_id, ''pending''
            FROM missing_refs mr
            RETURNING 1
          )
          SELECT 
            (SELECT COUNT(*) FROM missing_refs) as missing,
            (SELECT COUNT(*) FROM inserted_refs) as created
        ', job_table, job_table, job_table) 
        USING batch_record.id
        INTO missing_count, created_count;
        
        total_missing := total_missing + missing_count;
        total_created := total_created + created_count;
      END LOOP;
      
      IF total_missing > 0 OR total_created > 0 THEN
        RETURN QUERY SELECT batch_record.id, batch_record.name, total_missing, total_created;
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- Add unique constraint to prevent duplicate batch job references
ALTER TABLE public.batch_job_references 
DROP CONSTRAINT IF EXISTS unique_batch_job_reference;

ALTER TABLE public.batch_job_references 
ADD CONSTRAINT unique_batch_job_reference 
UNIQUE (batch_id, batch_job_id, batch_job_table);

-- Run repair function to fix existing data
SELECT * FROM public.validate_and_repair_batch_references();