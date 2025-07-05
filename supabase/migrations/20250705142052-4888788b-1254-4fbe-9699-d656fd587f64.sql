-- CLEAN BATCH SYSTEM FIX: Fix Column Name Errors and Simplify
-- Step 1: Fix the validation function to handle different column naming conventions

DROP FUNCTION IF EXISTS public.validate_batch_job_references() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_batch_job_references()
RETURNS TABLE(
  table_name text,
  job_id uuid, 
  job_number text,
  has_production_job boolean,
  production_job_id uuid,
  batch_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_table text;
  job_tables text[] := ARRAY['business_card_jobs', 'flyer_jobs', 'postcard_jobs', 'poster_jobs', 'sticker_jobs', 'cover_jobs', 'sleeve_jobs', 'box_jobs'];
BEGIN
  FOREACH job_table IN ARRAY job_tables LOOP
    -- Use dynamic SQL to handle different column names properly
    RETURN QUERY EXECUTE format('
      SELECT 
        %L::text as table_name,
        j.id::uuid as job_id,
        j.job_number::text as job_number,
        (pj.id IS NOT NULL)::boolean as has_production_job,
        pj.id::uuid as production_job_id,
        j.batch_id::uuid as batch_id
      FROM %I j
      LEFT JOIN public.production_jobs pj ON pj.wo_no = j.job_number
      WHERE j.batch_id IS NOT NULL
      ORDER BY j.created_at DESC
    ', job_table, job_table);
  END LOOP;
END;
$$;

-- Step 2: Update the trigger function to be more robust and non-blocking
DROP FUNCTION IF EXISTS public.create_batch_job_reference_automatically() CASCADE;

CREATE OR REPLACE FUNCTION public.create_batch_job_reference_automatically()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_table_name text;
  production_job_id_found uuid;
  job_number_to_match text;
BEGIN
  -- Determine the table name based on the trigger source
  batch_table_name := TG_TABLE_NAME;
  
  -- Only create reference if batch_id is being set (not null)
  IF NEW.batch_id IS NOT NULL AND (OLD IS NULL OR OLD.batch_id IS NULL OR OLD.batch_id != NEW.batch_id) THEN
    
    -- Get the job number to match - handle different column names gracefully
    job_number_to_match := NEW.job_number;
    
    IF job_number_to_match IS NULL OR job_number_to_match = '' THEN
      RAISE NOTICE 'No job number found for % job ID % - skipping batch reference creation', batch_table_name, NEW.id;
      RETURN NEW;
    END IF;
    
    -- Find the corresponding production job by job_number/wo_no
    SELECT pj.id INTO production_job_id_found
    FROM public.production_jobs pj
    WHERE pj.wo_no = job_number_to_match
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
      
      RAISE NOTICE 'Created batch job reference: % job % (ID: %) -> production job % in batch %', 
        batch_table_name, job_number_to_match, NEW.id, production_job_id_found, NEW.batch_id;
    ELSE
      RAISE NOTICE 'No matching production job found for % job % (ID: %) - batch reference not created (this is OK)', 
        batch_table_name, job_number_to_match, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 3: Recreate triggers for all job tables
DO $$
DECLARE
  job_table text;
  job_tables text[] := ARRAY['business_card_jobs', 'flyer_jobs', 'postcard_jobs', 'poster_jobs', 'sticker_jobs', 'cover_jobs', 'sleeve_jobs', 'box_jobs'];
BEGIN
  FOREACH job_table IN ARRAY job_tables LOOP
    -- Drop existing trigger if it exists
    EXECUTE format('DROP TRIGGER IF EXISTS create_batch_reference_%s ON public.%I', job_table, job_table);
    
    -- Create new trigger with updated function
    EXECUTE format('
      CREATE TRIGGER create_batch_reference_%s
        AFTER INSERT OR UPDATE OF batch_id ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.create_batch_job_reference_automatically()
    ', job_table, job_table);
    
    RAISE NOTICE 'Recreated batch reference trigger for %', job_table;
  END LOOP;
END;
$$;

-- Step 4: Update repair function to handle column names properly
DROP FUNCTION IF EXISTS public.repair_batch_job_references() CASCADE;

CREATE OR REPLACE FUNCTION public.repair_batch_job_references()
RETURNS TABLE(
  repaired_table text,
  repaired_job_id uuid,
  job_number text,
  created_reference boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_record RECORD;
  production_job_id_found uuid;
  job_table text;
  job_tables text[] := ARRAY['business_card_jobs', 'flyer_jobs', 'postcard_jobs', 'poster_jobs', 'sticker_jobs', 'cover_jobs', 'sleeve_jobs', 'box_jobs'];
BEGIN
  FOREACH job_table IN ARRAY job_tables LOOP
    FOR job_record IN EXECUTE format('
      SELECT 
        j.id,
        j.batch_id,
        j.job_number
      FROM %I j
      WHERE j.batch_id IS NOT NULL
        AND j.job_number IS NOT NULL
        AND j.job_number != ''''
        AND NOT EXISTS (
          SELECT 1 FROM public.batch_job_references bjr 
          WHERE bjr.batch_job_id = j.id 
          AND bjr.batch_job_table = %L
        )
    ', job_table, job_table)
    LOOP
      -- Find matching production job
      SELECT pj.id INTO production_job_id_found
      FROM public.production_jobs pj
      WHERE pj.wo_no = job_record.job_number
      LIMIT 1;
      
      IF production_job_id_found IS NOT NULL THEN
        -- Create the missing reference
        INSERT INTO public.batch_job_references (
          batch_id,
          batch_job_id,
          batch_job_table,
          production_job_id,
          status,
          created_at
        ) VALUES (
          job_record.batch_id,
          job_record.id,
          job_table,
          production_job_id_found,
          'pending',
          now()
        ) ON CONFLICT (production_job_id, batch_id) DO NOTHING;
        
        RETURN QUERY SELECT job_table::text, job_record.id::uuid, job_record.job_number::text, true::boolean;
      ELSE
        RETURN QUERY SELECT job_table::text, job_record.id::uuid, job_record.job_number::text, false::boolean;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;