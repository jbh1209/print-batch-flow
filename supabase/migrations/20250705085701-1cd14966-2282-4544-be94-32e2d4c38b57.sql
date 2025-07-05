-- Fix Batch References Data Integrity and Apply Comprehensive Batch Fix
-- Step 1: Clean up duplicate batch job references first

-- Remove duplicate batch job references, keeping the most recent one
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY production_job_id, batch_id, batch_job_table 
      ORDER BY created_at DESC
    ) as rn
  FROM public.batch_job_references
)
DELETE FROM public.batch_job_references 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Create the auto-creation function
CREATE OR REPLACE FUNCTION public.auto_create_batch_job_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_table_name text;
  production_job_id_found uuid;
BEGIN
  -- Determine the table name based on the trigger source
  batch_table_name := TG_TABLE_NAME;
  
  -- Only create reference if batch_id is being set (not null)
  IF NEW.batch_id IS NOT NULL AND (OLD.batch_id IS NULL OR OLD.batch_id != NEW.batch_id) THEN
    -- Find the corresponding production job by job_number
    SELECT pj.id INTO production_job_id_found
    FROM public.production_jobs pj
    WHERE pj.wo_no = NEW.job_number
    LIMIT 1;
    
    -- Only create reference if we found a matching production job
    IF production_job_id_found IS NOT NULL THEN
      INSERT INTO public.batch_job_references (
        batch_id,
        batch_job_id,
        batch_job_table,
        production_job_id,
        status,
        created_at
      ) VALUES (
        NEW.batch_id,
        NEW.id,
        batch_table_name,
        production_job_id_found,
        'pending',
        now()
      ) ON CONFLICT (production_job_id, batch_id) DO UPDATE SET
        batch_job_id = EXCLUDED.batch_job_id,
        batch_job_table = EXCLUDED.batch_job_table,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at;
      
      RAISE NOTICE 'Created/updated batch job reference for % job % in batch %', batch_table_name, NEW.job_number, NEW.batch_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 3: Create triggers for all job tables
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

-- Step 4: Validation and repair function
CREATE OR REPLACE FUNCTION public.validate_and_repair_batch_references(p_batch_id uuid DEFAULT NULL)
RETURNS TABLE(batch_id uuid, batch_name text, references_created integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_record RECORD;
  job_table text;
  job_tables text[] := ARRAY['business_card_jobs', 'flyer_jobs', 'postcard_jobs', 'poster_jobs', 'sticker_jobs', 'cover_jobs', 'sleeve_jobs', 'box_jobs'];
  created_count integer := 0;
  total_created integer := 0;
BEGIN
  -- Process specific batch or all batches
  FOR batch_record IN
    SELECT b.id, b.name 
    FROM public.batches b 
    WHERE (p_batch_id IS NULL OR b.id = p_batch_id)
      AND b.status != 'completed'
  LOOP
    total_created := 0;
    
    -- Process each job table for this batch
    FOREACH job_table IN ARRAY job_tables LOOP
      EXECUTE format('
        INSERT INTO public.batch_job_references (
          batch_id, batch_job_id, batch_job_table, production_job_id, status
        )
        SELECT 
          j.batch_id,
          j.id,
          %L,
          pj.id,
          ''pending''
        FROM %I j
        JOIN public.production_jobs pj ON j.job_number = pj.wo_no
        WHERE j.batch_id = $1
        ON CONFLICT (production_job_id, batch_id) DO NOTHING
      ', job_table, job_table) 
      USING batch_record.id;
      
      GET DIAGNOSTICS created_count = ROW_COUNT;
      total_created := total_created + created_count;
    END LOOP;
    
    IF total_created > 0 THEN
      RETURN QUERY SELECT batch_record.id, batch_record.name, total_created;
    END IF;
  END LOOP;
END;
$$;

-- Step 5: Run repair for existing data
SELECT * FROM public.validate_and_repair_batch_references();