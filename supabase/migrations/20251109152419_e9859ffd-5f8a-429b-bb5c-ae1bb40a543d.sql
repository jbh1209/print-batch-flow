-- ============================================================================
-- BACKFILL: Populate job_print_specifications from excel_import_mappings
-- ============================================================================
-- This populates job_print_specifications for existing jobs using the
-- excel_import_mappings to get the correct paper_type and paper_weight IDs
-- ============================================================================

DO $$
DECLARE
  v_job_record RECORD;
  v_paper_spec_raw_key text;
  v_mapping_record RECORD;
  v_inserted_count integer := 0;
  v_skipped_count integer := 0;
BEGIN
  RAISE NOTICE '🔧 [Backfill] Starting job_print_specifications backfill...';
  
  -- Loop through all production jobs that have paper_specifications
  FOR v_job_record IN 
    SELECT id, wo_no, paper_specifications
    FROM production_jobs
    WHERE paper_specifications IS NOT NULL 
      AND paper_specifications != '{}'::jsonb
    ORDER BY wo_no
  LOOP
    -- Extract first paper spec key from JSONB (e.g., "FBB Board, 300gsm, 530x750mm, White")
    SELECT (jsonb_each(v_job_record.paper_specifications)).key
    INTO v_paper_spec_raw_key
    LIMIT 1;
    
    IF v_paper_spec_raw_key IS NOT NULL THEN
      RAISE NOTICE '📋 [Job %] Looking up mapping for: "%"', v_job_record.wo_no, v_paper_spec_raw_key;
      
      -- Look up in excel_import_mappings (exact match first)
      SELECT 
        paper_type_specification_id,
        paper_weight_specification_id
      INTO v_mapping_record
      FROM excel_import_mappings
      WHERE excel_text = v_paper_spec_raw_key
        AND paper_type_specification_id IS NOT NULL
        AND paper_weight_specification_id IS NOT NULL
      LIMIT 1;
      
      -- If no exact match, try normalized (remove extra spaces)
      IF v_mapping_record IS NULL THEN
        SELECT 
          paper_type_specification_id,
          paper_weight_specification_id
        INTO v_mapping_record
        FROM excel_import_mappings
        WHERE regexp_replace(excel_text, '\s+', ' ', 'g') = regexp_replace(v_paper_spec_raw_key, '\s+', ' ', 'g')
          AND paper_type_specification_id IS NOT NULL
          AND paper_weight_specification_id IS NOT NULL
        LIMIT 1;
      END IF;
      
      IF v_mapping_record.paper_type_specification_id IS NOT NULL THEN
        -- Delete existing entries for this job (to avoid conflicts)
        DELETE FROM job_print_specifications
        WHERE job_id = v_job_record.id
          AND job_table_name = 'production_jobs'
          AND specification_category IN ('paper_type', 'paper_weight');
        
        -- Insert paper_type
        INSERT INTO job_print_specifications (
          job_id,
          job_table_name,
          specification_id,
          specification_category,
          created_at
        ) VALUES (
          v_job_record.id,
          'production_jobs',
          v_mapping_record.paper_type_specification_id,
          'paper_type',
          now()
        );
        
        -- Insert paper_weight
        INSERT INTO job_print_specifications (
          job_id,
          job_table_name,
          specification_id,
          specification_category,
          created_at
        ) VALUES (
          v_job_record.id,
          'production_jobs',
          v_mapping_record.paper_weight_specification_id,
          'paper_weight',
          now()
        );
        
        v_inserted_count := v_inserted_count + 1;
        RAISE NOTICE '✅ [Job %] Inserted paper specs (type: %, weight: %)', 
          v_job_record.wo_no, 
          v_mapping_record.paper_type_specification_id, 
          v_mapping_record.paper_weight_specification_id;
      ELSE
        v_skipped_count := v_skipped_count + 1;
        RAISE NOTICE '⚠️  [Job %] No mapping found for: "%"', v_job_record.wo_no, v_paper_spec_raw_key;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE '🎉 [Backfill] Complete - inserted: %, skipped: %', v_inserted_count, v_skipped_count;
END $$;