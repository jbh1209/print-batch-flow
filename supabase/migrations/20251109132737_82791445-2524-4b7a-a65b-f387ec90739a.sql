-- ============================================================================
-- BACKFILL: Update existing jobs with paper specification notes
-- ============================================================================
-- This is a ONE-TIME fix for jobs imported before the paper spec fix
-- Run this to update D427811 and any other jobs missing paper notes
-- ============================================================================

DO $$
DECLARE
  v_job_record RECORD;
  v_paper_spec_raw_key text;
  v_paper_weight_gsm text;
  v_paper_type_name text;
  v_paper_spec_text text;
  v_paper_note text;
  v_printing_stage_group_id uuid := '591c8a4d-3396-465b-b662-2d39c8b18132';
  v_updated_count integer := 0;
BEGIN
  RAISE NOTICE '🔧 [Backfill] Starting paper specification backfill...';
  
  -- Loop through all production jobs that have paper_specifications
  FOR v_job_record IN 
    SELECT id, wo_no, paper_specifications
    FROM production_jobs
    WHERE paper_specifications IS NOT NULL 
      AND paper_specifications != '{}'::jsonb
  LOOP
    -- Extract first paper spec key from JSONB
    SELECT (jsonb_each(v_job_record.paper_specifications)).key
    INTO v_paper_spec_raw_key
    LIMIT 1;
    
    IF v_paper_spec_raw_key IS NOT NULL THEN
      -- Parse weight and type
      v_paper_weight_gsm := (regexp_match(v_paper_spec_raw_key, '(\d+gsm)'))[1];
      v_paper_type_name := trim(split_part(v_paper_spec_raw_key, ',', 1));
      
      -- Build display text
      IF v_paper_weight_gsm IS NOT NULL AND v_paper_type_name IS NOT NULL THEN
        v_paper_spec_text := v_paper_weight_gsm || ' ' || v_paper_type_name;
      ELSIF v_paper_weight_gsm IS NOT NULL THEN
        v_paper_spec_text := v_paper_weight_gsm;
      ELSIF v_paper_type_name IS NOT NULL THEN
        v_paper_spec_text := v_paper_type_name;
      ELSE
        v_paper_spec_text := v_paper_spec_raw_key;
      END IF;
      
      v_paper_note := 'Paper: ' || v_paper_spec_text;
      
      -- Update printing stages for this job
      UPDATE job_stage_instances jsi
      SET notes = v_paper_note,
          updated_at = now()
      FROM production_stages ps
      WHERE jsi.production_stage_id = ps.id
        AND ps.stage_group_id = v_printing_stage_group_id
        AND jsi.job_id = v_job_record.id
        AND jsi.job_table_name = 'production_jobs'
        AND jsi.notes IS NULL;
      
      IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ [Backfill] Updated job % with note: "%"', v_job_record.wo_no, v_paper_note;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE '🎉 [Backfill] Complete - updated % jobs', v_updated_count;
END $$;