-- ============================================================================
-- FIX: Restore paper specification notes functionality
-- ============================================================================
-- Problem: Paper specifications aren't being extracted and set in stage notes
-- Solution: Extract from production_jobs.paper_specifications JSONB (reliable source)
--           instead of relying on p_consolidated_stages array
-- ============================================================================

CREATE OR REPLACE FUNCTION public.initialize_job_stages_with_multi_specs(
  p_job_id uuid, 
  p_job_table_name text, 
  p_consolidated_stages jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_record jsonb;
  v_spec_record jsonb;
  v_stage_instance_id uuid;
  v_created_count integer := 0;
  v_subtask_count integer := 0;
  v_total_duration integer;
  v_spec_duration integer;
  v_quantity integer;
  v_stage_supports_multi boolean;
  v_stage_supports_parts boolean;
  v_running_speed numeric;
  v_make_ready_time integer;
  v_speed_unit text;
  v_spec_count integer;
  v_stage_name text;
  v_part_type text;
  v_part_assignment text;
  v_part_name text;
  
  -- Variables for paper specification handling
  v_paper_spec_raw_key text := NULL;
  v_paper_spec_text text := NULL;
  v_paper_weight_gsm text := NULL;
  v_paper_type_name text := NULL;
  v_stage_group_id uuid;
  v_printing_stage_group_id uuid := '591c8a4d-3396-465b-b662-2d39c8b18132';
  v_paper_type_id uuid;
  v_paper_weight_id uuid;
  v_paper_note text;
BEGIN
  RAISE NOTICE '🎯 [initialize_job_stages_with_multi_specs] Starting for job % with % stages', p_job_id, jsonb_array_length(p_consolidated_stages);
  
  -- ============================================================================
  -- STEP 1: Extract paper specification from production_jobs.paper_specifications
  -- This is the reliable source (populated during Excel import)
  -- ============================================================================
  BEGIN
    SELECT 
      (jsonb_each(pj.paper_specifications)).key
    INTO v_paper_spec_raw_key
    FROM production_jobs pj
    WHERE pj.id = p_job_id
    LIMIT 1;
    
    IF v_paper_spec_raw_key IS NOT NULL THEN
      RAISE NOTICE '📄 [Paper Extraction] Found raw paper key: "%"', v_paper_spec_raw_key;
      
      -- Parse weight (first part with 'gsm')
      v_paper_weight_gsm := (regexp_match(v_paper_spec_raw_key, '(\d+gsm)'))[1];
      
      -- Parse type (first part before comma, typically)
      v_paper_type_name := split_part(v_paper_spec_raw_key, ',', 1);
      v_paper_type_name := trim(v_paper_type_name);
      
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
      
      RAISE NOTICE '✅ [Paper Parsing] Extracted: weight=%, type=%, display="%"', 
        COALESCE(v_paper_weight_gsm, 'NULL'), 
        COALESCE(v_paper_type_name, 'NULL'),
        v_paper_spec_text;
      
      -- Look up paper type and weight IDs from excel_import_mappings
      SELECT 
        paper_type_specification_id,
        paper_weight_specification_id
      INTO v_paper_type_id, v_paper_weight_id
      FROM excel_import_mappings
      WHERE mapping_type = 'paper_specification'
        AND excel_text = v_paper_spec_raw_key
      LIMIT 1;
      
      IF v_paper_type_id IS NULL AND v_paper_weight_id IS NULL THEN
        RAISE NOTICE '⚠️ [Paper Lookup] Exact match not found, trying normalized...';
        SELECT 
          paper_type_specification_id,
          paper_weight_specification_id
        INTO v_paper_type_id, v_paper_weight_id
        FROM excel_import_mappings
        WHERE mapping_type = 'paper_specification'
          AND REPLACE(REPLACE(excel_text, ' ,', ','), ', ', ',') ILIKE REPLACE(REPLACE(v_paper_spec_raw_key, ' ,', ','), ', ', ',')
        LIMIT 1;
      END IF;
      
      IF v_paper_type_id IS NOT NULL OR v_paper_weight_id IS NOT NULL THEN
        RAISE NOTICE '✅ [Paper Lookup] Found mapping IDs: type=%, weight=%', 
          COALESCE(v_paper_type_id::text, 'NULL'), 
          COALESCE(v_paper_weight_id::text, 'NULL');
      ELSE
        RAISE NOTICE '⚠️ [Paper Lookup] No mapping found for "%"', v_paper_spec_raw_key;
      END IF;
    ELSE
      RAISE NOTICE '⚠️ [Paper Extraction] No paper_specifications found in production_jobs for job %', p_job_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ [Paper Extraction] Error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
      v_paper_spec_text := NULL;
  END;
  
  -- ============================================================================
  -- STEP 2: Create job_stage_instances for each consolidated stage
  -- ============================================================================
  FOR v_stage_record IN SELECT * FROM jsonb_array_elements(p_consolidated_stages)
  LOOP
    v_spec_count := jsonb_array_length(v_stage_record->'specifications');
    v_part_type := v_stage_record->>'part_type';
    
    -- Determine part_assignment and part_name
    IF v_part_type IS NOT NULL THEN
      v_part_assignment := LOWER(v_part_type);
      v_part_name := INITCAP(v_part_type);
    ELSE
      v_part_assignment := 'both';
      v_part_name := NULL;
    END IF;
    
    -- Get stage info
    SELECT 
      supports_multi_specifications, 
      supports_parts,
      name,
      stage_group_id
    INTO v_stage_supports_multi, v_stage_supports_parts, v_stage_name, v_stage_group_id
    FROM production_stages
    WHERE id = (v_stage_record->>'stage_id')::uuid;
    
    RAISE NOTICE '📋 [Stage Creation] Processing "%": specs=%, part=%, group=%',
      v_stage_name, v_spec_count, COALESCE(v_part_type, 'none'), v_stage_group_id;
    
    -- Determine if this is a printing stage and prepare notes
    v_paper_note := NULL;
    IF v_stage_group_id = v_printing_stage_group_id AND v_paper_spec_text IS NOT NULL THEN
      v_paper_note := 'Paper: ' || v_paper_spec_text;
      RAISE NOTICE '📝 [Stage Notes] Will set printing stage notes: "%"', v_paper_note;
    END IF;
    
    -- Create stage instance
    INSERT INTO job_stage_instances (
      job_id,
      job_table_name,
      production_stage_id,
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
      (v_stage_record->>'stage_order')::integer,
      'pending',
      COALESCE((v_stage_record->'specifications'->0->>'quantity')::integer, 1),
      v_part_assignment,
      v_part_name,
      v_paper_note,  -- Set paper notes for printing stages
      now(),
      now()
    )
    RETURNING id INTO v_stage_instance_id;
    
    v_created_count := v_created_count + 1;
    RAISE NOTICE '✅ [Stage Created] Instance % for "%"', v_stage_instance_id, v_stage_name;
    
    -- ============================================================================
    -- STEP 3: Create sub-tasks for multi-spec stages
    -- ============================================================================
    IF v_spec_count > 1 AND v_part_type IS NULL AND v_stage_supports_multi THEN
      RAISE NOTICE '🔍 [Multi-Spec] Creating % sub-tasks', v_spec_count;
      v_total_duration := 0;
      
      FOR v_spec_record IN SELECT * FROM jsonb_array_elements(v_stage_record->'specifications')
      LOOP
        v_quantity := COALESCE((v_spec_record->>'quantity')::integer, 1);
        
        -- Get timing data
        IF (v_spec_record->>'specification_id')::uuid IS NOT NULL THEN
          SELECT 
            running_speed_per_hour,
            make_ready_time_minutes,
            speed_unit
          INTO v_running_speed, v_make_ready_time, v_speed_unit
          FROM stage_specifications
          WHERE id = (v_spec_record->>'specification_id')::uuid;
          
          IF v_running_speed IS NOT NULL AND v_running_speed > 0 THEN
            BEGIN
              SELECT * INTO v_spec_duration
              FROM calculate_stage_timing(
                v_quantity,
                v_running_speed,
                COALESCE(v_make_ready_time, 0),
                COALESCE(v_speed_unit, 'sheets')
              );
            EXCEPTION WHEN OTHERS THEN
              v_spec_duration := 60;
            END;
          ELSE
            v_spec_duration := 60;
          END IF;
        ELSE
          v_spec_duration := 60;
        END IF;
        
        v_total_duration := v_total_duration + v_spec_duration;
        
        INSERT INTO stage_sub_tasks (
          stage_instance_id,
          specification_id,
          quantity,
          estimated_duration_minutes,
          status,
          sort_order,
          created_at,
          updated_at
        ) VALUES (
          v_stage_instance_id,
          (v_spec_record->>'specification_id')::uuid,
          v_quantity,
          v_spec_duration,
          'pending',
          (v_spec_record->>'stage_order')::integer,
          now(),
          now()
        );
        
        v_subtask_count := v_subtask_count + 1;
      END LOOP;
      
      UPDATE job_stage_instances
      SET estimated_duration_minutes = v_total_duration
      WHERE id = v_stage_instance_id;
      
      RAISE NOTICE '✅ [Multi-Spec] Created % sub-tasks, total: % min', v_spec_count, v_total_duration;
      
    ELSIF v_spec_count = 1 THEN
      -- Single spec: apply timing directly
      v_spec_record := v_stage_record->'specifications'->0;
      v_quantity := COALESCE((v_spec_record->>'quantity')::integer, 1);
      
      IF (v_spec_record->>'specification_id')::uuid IS NOT NULL THEN
        SELECT 
          running_speed_per_hour,
          make_ready_time_minutes,
          speed_unit
        INTO v_running_speed, v_make_ready_time, v_speed_unit
        FROM stage_specifications
        WHERE id = (v_spec_record->>'specification_id')::uuid;
        
        IF v_running_speed IS NOT NULL AND v_running_speed > 0 THEN
          BEGIN
            SELECT * INTO v_spec_duration
            FROM calculate_stage_timing(
              v_quantity,
              v_running_speed,
              COALESCE(v_make_ready_time, 0),
              COALESCE(v_speed_unit, 'sheets')
            );
          EXCEPTION WHEN OTHERS THEN
            v_spec_duration := 60;
          END;
        ELSE
          v_spec_duration := 60;
        END IF;
      ELSE
        v_spec_duration := 60;
      END IF;
      
      UPDATE job_stage_instances
      SET estimated_duration_minutes = v_spec_duration
      WHERE id = v_stage_instance_id;
      
      RAISE NOTICE '✅ [Single-Spec] Duration: % min', v_spec_duration;
    END IF;
  END LOOP;
  
  -- ============================================================================
  -- STEP 4: Save paper specifications to job_print_specifications (job-level)
  -- ============================================================================
  IF v_paper_spec_raw_key IS NOT NULL AND (v_paper_type_id IS NOT NULL OR v_paper_weight_id IS NOT NULL) THEN
    RAISE NOTICE '💾 [Job Specs] Saving paper specs to job_print_specifications...';
    
    -- Delete existing
    DELETE FROM job_print_specifications
    WHERE job_id = p_job_id
      AND job_table_name = p_job_table_name
      AND specification_category IN ('paper_type', 'paper_weight');
    
    -- Insert paper type
    IF v_paper_type_id IS NOT NULL THEN
      INSERT INTO job_print_specifications (
        job_id, job_table_name, specification_category, specification_id, created_at
      ) VALUES (
        p_job_id, p_job_table_name, 'paper_type', v_paper_type_id, now()
      );
      RAISE NOTICE '✅ [Job Specs] Inserted paper_type: %', v_paper_type_id;
    END IF;
    
    -- Insert paper weight
    IF v_paper_weight_id IS NOT NULL THEN
      INSERT INTO job_print_specifications (
        job_id, job_table_name, specification_category, specification_id, created_at
      ) VALUES (
        p_job_id, p_job_table_name, 'paper_weight', v_paper_weight_id, now()
      );
      RAISE NOTICE '✅ [Job Specs] Inserted paper_weight: %', v_paper_weight_id;
    END IF;
  END IF;
  
  RAISE NOTICE '🎉 [Complete] Created % stages, % sub-tasks', v_created_count, v_subtask_count;
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '❌ [Fatal] Failed to initialize job stages: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN FALSE;
END;
$function$;