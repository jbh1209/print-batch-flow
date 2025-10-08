-- Phase 1: Enable multi-specification support for all printing stages
UPDATE production_stages
SET supports_multi_specifications = true
WHERE name IN ('Printing - HP 12000', 'Printing - T250', 'Printing - 7900', 'Large Format Printing')
  AND supports_multi_specifications = false;

-- Phase 2: Improve RPC with defensive logic and better logging
CREATE OR REPLACE FUNCTION public.initialize_job_stages_with_multi_specs(
  p_job_id uuid, 
  p_job_table_name text, 
  p_consolidated_stages jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  v_has_part_keywords boolean;
  v_stage_name text;
BEGIN
  RAISE NOTICE '🎯 Starting multi-spec workflow initialization for job %', p_job_id;
  
  -- Iterate through each consolidated stage
  FOR v_stage_record IN SELECT * FROM jsonb_array_elements(p_consolidated_stages)
  LOOP
    v_spec_count := jsonb_array_length(v_stage_record->'specifications');
    
    -- Check stage capabilities
    SELECT 
      supports_multi_specifications, 
      supports_parts,
      name
    INTO v_stage_supports_multi, v_stage_supports_parts, v_stage_name
    FROM production_stages
    WHERE id = (v_stage_record->>'stage_id')::uuid;
    
    -- Defensive check: detect if specifications have part keywords (cover/text)
    v_has_part_keywords := EXISTS (
      SELECT 1 
      FROM jsonb_array_elements(v_stage_record->'specifications') spec
      WHERE LOWER(spec->>'specification_name') LIKE '%cover%'
         OR LOWER(spec->>'specification_name') LIKE '%text%'
    );
    
    RAISE NOTICE '📋 Processing stage "%": % specs, supports_multi=%, supports_parts=%, has_part_keywords=%',
      v_stage_name, v_spec_count, v_stage_supports_multi, v_stage_supports_parts, v_has_part_keywords;
    
    -- Create ONE job_stage_instance per unique production_stage_id
    INSERT INTO job_stage_instances (
      job_id,
      job_table_name,
      production_stage_id,
      stage_order,
      status,
      quantity,
      created_at,
      updated_at
    ) VALUES (
      p_job_id,
      p_job_table_name,
      (v_stage_record->>'stage_id')::uuid,
      (v_stage_record->>'stage_order')::integer,
      'pending',
      COALESCE((v_stage_record->'specifications'->0->>'quantity')::integer, 1),
      now(),
      now()
    )
    RETURNING id INTO v_stage_instance_id;
    
    v_created_count := v_created_count + 1;
    RAISE NOTICE '✅ Created stage instance % for stage %', v_stage_instance_id, v_stage_record->>'stage_id';
    
    -- DEFENSIVE LOGIC: Force sub-task creation if multiple specs with part keywords, even if supports_multi=false
    IF v_spec_count > 1 AND (v_stage_supports_multi OR (v_stage_supports_parts AND v_has_part_keywords)) THEN
      IF NOT v_stage_supports_multi AND v_stage_supports_parts AND v_has_part_keywords THEN
        RAISE WARNING '⚠️ Stage "%" has supports_multi_specifications=false but has % specs with part keywords - forcing sub-task creation as guardrail',
          v_stage_name, v_spec_count;
      END IF;
      
      RAISE NOTICE '🔍 Stage has % specifications, creating sub-tasks with REAL timing', v_spec_count;
      
      v_total_duration := 0;
      
      -- Create stage_sub_tasks for each specification with REAL timing calculation
      FOR v_spec_record IN SELECT * FROM jsonb_array_elements(v_stage_record->'specifications')
      LOOP
        v_quantity := COALESCE((v_spec_record->>'quantity')::integer, 1);
        
        -- Fetch specification timing data
        SELECT 
          running_speed_per_hour,
          make_ready_time_minutes,
          speed_unit
        INTO v_running_speed, v_make_ready_time, v_speed_unit
        FROM stage_specifications
        WHERE id = (v_spec_record->>'specification_id')::uuid;
        
        -- Calculate REAL duration using the timing calculation function
        IF v_running_speed IS NOT NULL AND v_running_speed > 0 THEN
          BEGIN
            SELECT * INTO v_spec_duration
            FROM calculate_stage_timing(
              v_quantity,
              v_running_speed,
              COALESCE(v_make_ready_time, 10),
              COALESCE(v_speed_unit, 'sheets_per_hour')
            );
            
            RAISE NOTICE '  ✅ Calculated timing for "%": % mins (qty=%, speed=%, makeup=%)', 
              v_spec_record->>'specification_name', v_spec_duration, v_quantity, v_running_speed, v_make_ready_time;
          EXCEPTION WHEN OTHERS THEN
            -- Fallback to default if calculation fails
            v_spec_duration := 60;
            RAISE WARNING '  ⚠️ Timing calculation failed for "%", using 60min default: %', 
              v_spec_record->>'specification_name', SQLERRM;
          END;
        ELSE
          -- No timing data available, use default
          v_spec_duration := 60;
          RAISE WARNING '  ⚠️ No timing data for spec "%" (id: %), using 60min default', 
            v_spec_record->>'specification_name', v_spec_record->>'specification_id';
        END IF;
        
        -- Insert sub-task with calculated duration
        INSERT INTO stage_sub_tasks (
          stage_instance_id,
          stage_specification_id,
          sub_task_order,
          quantity,
          status,
          estimated_duration_minutes,
          created_at,
          updated_at
        ) VALUES (
          v_stage_instance_id,
          (v_spec_record->>'specification_id')::uuid,
          v_subtask_count + 1,
          v_quantity,
          'pending',
          v_spec_duration,
          now(),
          now()
        );
        
        v_total_duration := v_total_duration + v_spec_duration;
        v_subtask_count := v_subtask_count + 1;
        
        RAISE NOTICE '  ✅ Created sub-task #% for spec "%" with duration % mins', 
          v_subtask_count, v_spec_record->>'specification_name', v_spec_duration;
      END LOOP;
      
      -- Update stage instance with ACCURATE total duration (sum of all sub-tasks)
      UPDATE job_stage_instances
      SET estimated_duration_minutes = v_total_duration
      WHERE id = v_stage_instance_id;
      
      RAISE NOTICE '✅ Updated stage instance with ACCURATE total duration: % mins (from % sub-tasks)', 
        v_total_duration, v_subtask_count;
    ELSE
      -- Single specification stage: set stage_specification_id directly on the instance
      IF v_spec_count = 1 THEN
        RAISE NOTICE '📌 Single specification stage - setting stage_specification_id directly';
        UPDATE job_stage_instances
        SET stage_specification_id = (v_stage_record->'specifications'->0->>'specification_id')::uuid
        WHERE id = v_stage_instance_id;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE '🎯 Multi-spec initialization complete: % stages, % sub-tasks created', v_created_count, v_subtask_count;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to initialize multi-spec workflow: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN FALSE;
END;
$$;

-- Phase 4: Repair affected jobs D426815 and D426821
-- Delete existing pending/scheduled stage instances for these jobs
DELETE FROM job_stage_instances
WHERE job_table_name = 'production_jobs'
  AND status IN ('pending', 'scheduled')
  AND job_id IN (
    SELECT id FROM production_jobs 
    WHERE wo_no IN ('D426815', 'D426821')
  );

-- Add comment for documentation
COMMENT ON FUNCTION public.initialize_job_stages_with_multi_specs IS 'Initializes job stages with multi-specification support and defensive part keyword detection';