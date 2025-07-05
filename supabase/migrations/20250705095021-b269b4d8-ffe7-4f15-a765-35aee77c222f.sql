-- =======================================================================================
-- PHASE 1: COMPREHENSIVE BATCH SYSTEM OVERHAUL - DATABASE FOUNDATION
-- =======================================================================================
-- This migration completely replaces the broken batch creation system with a unified, 
-- reliable solution that creates proper batch job references automatically via triggers.

-- Step 1: Drop all existing broken trigger functions
DROP FUNCTION IF EXISTS public.validate_and_repair_batch_references(uuid);
DROP FUNCTION IF EXISTS public.create_batch_job_reference_on_update();
DROP FUNCTION IF EXISTS public.handle_batch_job_allocation();

-- Step 2: Create comprehensive batch job reference creation function
-- This function will be called by triggers whenever a job gets a batch_id
CREATE OR REPLACE FUNCTION public.create_batch_job_reference_automatically()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create reference if batch_id is being set (not cleared)
  IF NEW.batch_id IS NOT NULL AND (OLD.batch_id IS NULL OR OLD.batch_id != NEW.batch_id) THEN
    
    -- Log the operation for debugging
    RAISE NOTICE 'Creating batch job reference: job_id=%, batch_id=%, table=%', NEW.id, NEW.batch_id, TG_TABLE_NAME;
    
    -- Insert batch job reference with proper error handling
    INSERT INTO public.batch_job_references (
      production_job_id,
      batch_id,
      batch_job_table,
      batch_job_id,
      status,
      notes
    ) VALUES (
      NEW.id,
      NEW.batch_id,
      TG_TABLE_NAME,
      NEW.id,  -- batch_job_id points to the job in the product table
      'pending',
      format('Auto-created reference for %s job', TG_TABLE_NAME)
    )
    ON CONFLICT (production_job_id, batch_id) DO UPDATE SET
      batch_job_table = EXCLUDED.batch_job_table,
      batch_job_id = EXCLUDED.batch_job_id,
      status = EXCLUDED.status,
      notes = EXCLUDED.notes || ' (updated)';
      
    RAISE NOTICE 'Successfully created/updated batch job reference for job % in batch %', NEW.id, NEW.batch_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create triggers on ALL product job tables to automatically create references
-- This ensures that whenever ANY job gets assigned to a batch, a reference is created

-- Business Cards
DROP TRIGGER IF EXISTS create_batch_reference_trigger ON public.business_card_jobs;
CREATE TRIGGER create_batch_reference_trigger
  AFTER UPDATE OF batch_id ON public.business_card_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_batch_job_reference_automatically();

-- Flyers  
DROP TRIGGER IF EXISTS create_batch_reference_trigger ON public.flyer_jobs;
CREATE TRIGGER create_batch_reference_trigger
  AFTER UPDATE OF batch_id ON public.flyer_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_batch_job_reference_automatically();

-- Postcards
DROP TRIGGER IF EXISTS create_batch_reference_trigger ON public.postcard_jobs;
CREATE TRIGGER create_batch_reference_trigger
  AFTER UPDATE OF batch_id ON public.postcard_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_batch_job_reference_automatically();

-- Sleeves
DROP TRIGGER IF EXISTS create_batch_reference_trigger ON public.sleeve_jobs;
CREATE TRIGGER create_batch_reference_trigger
  AFTER UPDATE OF batch_id ON public.sleeve_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_batch_job_reference_automatically();

-- Boxes
DROP TRIGGER IF EXISTS create_batch_reference_trigger ON public.box_jobs;
CREATE TRIGGER create_batch_reference_trigger
  AFTER UPDATE OF batch_id ON public.box_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_batch_job_reference_automatically();

-- Covers
DROP TRIGGER IF EXISTS create_batch_reference_trigger ON public.cover_jobs;
CREATE TRIGGER create_batch_reference_trigger  
  AFTER UPDATE OF batch_id ON public.cover_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_batch_job_reference_automatically();

-- Posters
DROP TRIGGER IF EXISTS create_batch_reference_trigger ON public.poster_jobs;
CREATE TRIGGER create_batch_reference_trigger
  AFTER UPDATE OF batch_id ON public.poster_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_batch_job_reference_automatically();

-- Sticker Jobs (if the table exists)
DROP TRIGGER IF EXISTS create_batch_reference_trigger ON public.sticker_jobs;
-- Only create trigger if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sticker_jobs' AND table_schema = 'public') THEN
    EXECUTE 'CREATE TRIGGER create_batch_reference_trigger
      AFTER UPDATE OF batch_id ON public.sticker_jobs
      FOR EACH ROW
      EXECUTE FUNCTION public.create_batch_job_reference_automatically()';
  END IF;
END $$;

-- Step 4: Create master job creation function for "Send to Print"
-- This replaces the complex enhanced batch processor logic
CREATE OR REPLACE FUNCTION public.create_batch_master_job_simple(
  p_batch_id uuid
) RETURNS uuid AS $$
DECLARE
  batch_record RECORD;
  constituent_job_ids uuid[];
  master_job_id uuid;
BEGIN
  -- Validate batch exists
  SELECT * INTO batch_record FROM public.batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch with ID % not found', p_batch_id;
  END IF;
  
  -- Get constituent job IDs from batch references
  SELECT array_agg(production_job_id) INTO constituent_job_ids
  FROM public.batch_job_references
  WHERE batch_id = p_batch_id;
  
  IF constituent_job_ids IS NULL OR array_length(constituent_job_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No constituent jobs found for batch %', p_batch_id;
  END IF;
  
  RAISE NOTICE 'Creating master job for batch % with % constituent jobs', p_batch_id, array_length(constituent_job_ids, 1);
  
  -- Create master job in production_jobs
  INSERT INTO public.production_jobs (
    wo_no,
    customer,
    status,
    qty,
    user_id,
    batch_category,
    is_batch_master,
    created_at,
    updated_at
  ) VALUES (
    batch_record.name || '-MASTER',
    'Batch Master Job',
    'Ready to Print',
    batch_record.sheets_required,
    batch_record.created_by,
    'master',
    true,
    now(),
    now()
  ) RETURNING id INTO master_job_id;
  
  RAISE NOTICE 'Created master job with ID: %', master_job_id;
  
  -- Update batch status
  UPDATE public.batches 
  SET status = 'completed', updated_at = now()
  WHERE id = p_batch_id;
  
  RETURN master_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_batch_job_reference_automatically() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_batch_master_job_simple(uuid) TO authenticated;

-- Step 5: Create batch validation function (simplified)
CREATE OR REPLACE FUNCTION public.validate_batch_simple(p_batch_id uuid)
RETURNS TABLE(
  is_valid boolean,
  reference_count integer,
  missing_jobs integer,
  message text
) AS $$
DECLARE
  batch_exists boolean;
  ref_count integer;
  missing_count integer;
  validation_message text;
BEGIN
  -- Check if batch exists
  SELECT EXISTS(SELECT 1 FROM public.batches WHERE id = p_batch_id) INTO batch_exists;
  
  IF NOT batch_exists THEN
    RETURN QUERY SELECT false, 0, 0, 'Batch does not exist';
    RETURN;
  END IF;
  
  -- Count batch job references
  SELECT COUNT(*) INTO ref_count
  FROM public.batch_job_references
  WHERE batch_id = p_batch_id;
  
  -- Count missing production jobs (orphaned references)
  SELECT COUNT(*) INTO missing_count
  FROM public.batch_job_references bjr
  LEFT JOIN public.production_jobs pj ON pj.id = bjr.production_job_id
  WHERE bjr.batch_id = p_batch_id AND pj.id IS NULL;
  
  -- Determine validation result
  IF ref_count = 0 THEN
    validation_message := 'No batch references found';
    RETURN QUERY SELECT false, ref_count, missing_count, validation_message;
  ELSIF missing_count > 0 THEN
    validation_message := format('%s references found, %s missing production jobs', ref_count, missing_count);
    RETURN QUERY SELECT false, ref_count, missing_count, validation_message;
  ELSE
    validation_message := format('%s valid references found', ref_count);
    RETURN QUERY SELECT true, ref_count, missing_count, validation_message;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.validate_batch_simple(uuid) TO authenticated;