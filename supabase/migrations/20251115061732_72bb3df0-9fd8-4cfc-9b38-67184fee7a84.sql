-- ============================================================
-- FIX: stage_specification_id insertion and timing calculations (FINAL)
-- ============================================================
-- Problem: initialize_job_stages_with_multi_specs doesn't set stage_specification_id
-- This causes timing calculations to fall back to base stage speeds instead of spec speeds
-- Solution: Update function + retroactively fix existing jobs + recalculate timing
-- ============================================================

-- PART 1: Fix the initialize_job_stages_with_multi_specs function
-- ============================================================

-- Drop all versions of the function first
DROP FUNCTION IF EXISTS public.initialize_job_stages_with_multi_specs CASCADE;

-- Recreate with stage_specification_id support
CREATE FUNCTION public.initialize_job_stages_with_multi_specs(
  p_job_id uuid,
  p_job_table_name text,
  p_category_id uuid,
  p_stage_specifications jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stage_record jsonb;
  v_part_assignment text;
  v_part_name text;
  v_paper_note text;
  v_result jsonb := jsonb_build_object('success', false, 'stages_created', 0);
  v_stages_created integer := 0;
BEGIN
  -- Validate inputs
  IF p_job_id IS NULL OR p_category_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required parameters');
  END IF;

  -- Delete existing pending stages for this job
  DELETE FROM job_stage_instances 
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND status = 'pending';

  -- Process each stage from the specifications
  FOR v_stage_record IN SELECT * FROM jsonb_array_elements(p_stage_specifications)
  LOOP
    -- Extract part assignment and part name
    v_part_assignment := v_stage_record->>'part_assignment';
    v_part_name := v_stage_record->>'part_name';
    
    -- Build paper note from specifications if available
    v_paper_note := '';
    IF jsonb_array_length(v_stage_record->'specifications') > 0 THEN
      v_paper_note := string_agg(
        (spec->>'description'),
        ', '
      ) FROM jsonb_array_elements(v_stage_record->'specifications') spec;
    END IF;

    -- Insert the main stage instance with stage_specification_id
    INSERT INTO job_stage_instances (
      job_id,
      job_table_name,
      production_stage_id,
      stage_specification_id,  -- ← FIXED: Now includes specification ID
      stage_order,
      status,
      quantity,
      part_assignment,
      part_name,
      notes,
      created_at,
      updated_at
    ) VALUES (
      p_job_id,
      p_job_table_name,
      (v_stage_record->>'stage_id')::uuid,
      (v_stage_record->'specifications'->0->>'specification_id')::uuid,  -- ← FIXED: Use first spec ID
      (v_stage_record->>'stage_order')::integer,
      'pending',
      COALESCE((v_stage_record->'specifications'->0->>'quantity')::integer, 1),
      v_part_assignment,
      v_part_name,
      v_paper_note,
      now(),
      now()
    );

    v_stages_created := v_stages_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'stages_created', v_stages_created
  );
END;
$$;

-- PART 2: Retroactive Fix for Existing Jobs
-- ============================================================

-- Step 2A: Update stage_specification_id for printing stages by matching descriptions
WITH printing_spec_matches AS (
  SELECT DISTINCT
    jsi.id as stage_instance_id,
    pj.wo_no,
    ps.name as stage_name,
    spec_value->>'description' as clean_spec_name,
    eim.stage_specification_id,
    jsi.production_stage_id,
    ss.running_speed_per_hour as spec_speed
  FROM job_stage_instances jsi
  JOIN production_jobs pj ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
  JOIN production_stages ps ON jsi.production_stage_id = ps.id
  CROSS JOIN LATERAL jsonb_each(pj.printing_specifications) AS specs(spec_key, spec_value)
  LEFT JOIN excel_import_mappings eim 
    ON LOWER(TRIM(eim.excel_text)) = LOWER(TRIM(spec_value->>'description'))
    AND eim.production_stage_id = jsi.production_stage_id
    AND eim.mapping_type = 'production_stage'
  LEFT JOIN stage_specifications ss ON eim.stage_specification_id = ss.id
  WHERE jsi.stage_specification_id IS NULL
    AND ps.name IN ('Printing - HP 12000', 'Printing - T250', 'Printing - 7900', 'Large Format Printing')
    AND pj.printing_specifications IS NOT NULL
    AND eim.stage_specification_id IS NOT NULL
)
UPDATE job_stage_instances jsi
SET 
  stage_specification_id = psm.stage_specification_id,
  updated_at = now()
FROM printing_spec_matches psm
WHERE jsi.id = psm.stage_instance_id;

-- Step 2B: Recalculate estimated_duration_minutes for ALL affected printing stages
UPDATE job_stage_instances jsi
SET 
  estimated_duration_minutes = timing_calc.new_duration,
  updated_at = now()
FROM (
  SELECT 
    jsi2.id,
    calculate_stage_duration(
      jsi2.quantity,
      COALESCE(ss.running_speed_per_hour, ps.running_speed_per_hour, 100),
      COALESCE(ss.make_ready_time_minutes, ps.make_ready_time_minutes, 10),
      COALESCE(ss.speed_unit, ps.speed_unit, 'sheets_per_hour')
    ) as new_duration
  FROM job_stage_instances jsi2
  JOIN production_stages ps ON jsi2.production_stage_id = ps.id
  LEFT JOIN stage_specifications ss ON jsi2.stage_specification_id = ss.id
  WHERE ps.name LIKE '%Printing%'
    AND jsi2.status IN ('pending', 'scheduled', 'active')
    AND jsi2.quantity IS NOT NULL
    AND jsi2.quantity > 0
) timing_calc
WHERE jsi.id = timing_calc.id;

-- PART 3: Add Monitoring & Prevention
-- ============================================================

-- Create warning trigger for missing specifications
CREATE OR REPLACE FUNCTION public.validate_printing_stage_has_spec()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM production_stages 
    WHERE id = NEW.production_stage_id 
    AND name LIKE '%Printing%'
  ) AND NEW.stage_specification_id IS NULL THEN
    RAISE WARNING 'Printing stage created without specification ID for job % on stage %', 
      NEW.job_id, NEW.production_stage_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS warn_missing_printing_spec ON job_stage_instances;
CREATE TRIGGER warn_missing_printing_spec
BEFORE INSERT ON job_stage_instances
FOR EACH ROW
EXECUTE FUNCTION validate_printing_stage_has_spec();

-- Create monitoring view for suspicious timing
DROP VIEW IF EXISTS public.v_suspicious_printing_timing;
CREATE VIEW public.v_suspicious_printing_timing AS
SELECT 
  pj.wo_no,
  ps.name as stage_name,
  jsi.quantity,
  jsi.estimated_duration_minutes,
  jsi.stage_specification_id,
  ss.name as specification_name,
  ss.running_speed_per_hour as spec_speed,
  ps.running_speed_per_hour as base_speed,
  CASE 
    WHEN jsi.stage_specification_id IS NULL THEN 'Missing Specification'
    WHEN jsi.estimated_duration_minutes > 300 AND jsi.quantity < 5000 THEN 'Suspiciously Long'
    ELSE 'OK'
  END as timing_status
FROM job_stage_instances jsi
JOIN production_jobs pj ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
JOIN production_stages ps ON jsi.production_stage_id = ps.id
LEFT JOIN stage_specifications ss ON jsi.stage_specification_id = ss.id
WHERE ps.name LIKE '%Printing%'
  AND jsi.status IN ('pending', 'scheduled', 'active')
ORDER BY jsi.estimated_duration_minutes DESC;

COMMENT ON FUNCTION public.initialize_job_stages_with_multi_specs IS 'FIXED: Now includes stage_specification_id in INSERT statement for proper timing calculations';
COMMENT ON VIEW public.v_suspicious_printing_timing IS 'Monitoring view to identify printing stages with missing specifications or suspicious timing';