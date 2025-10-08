-- Phase 3: Update RPC to handle part-based stage creation properly
-- This ensures Cover/Text parts create separate stage instances with correct part_assignment

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
BEGIN
  RAISE NOTICE '🎯 Starting workflow initialization for job % with % consolidated stages', p_job_id, jsonb_array_length(p_consolidated_stages);
  
  -- Iterate through each consolidated stage (now separated by part_type in the composite key)
  FOR v_stage_record IN SELECT * FROM jsonb_array_elements(p_consolidated_stages)
  LOOP
    v_spec_count := jsonb_array_length(v_stage_record->'specifications');
    v_part_type := v_stage_record->>'part_type';
    
    -- Determine part_assignment and part_name based on part_type
    IF v_part_type IS NOT NULL THEN
      v_part_assignment := LOWER(v_part_type); -- 'cover' or 'text'
      v_part_name := INITCAP(v_part_type); -- 'Cover' or 'Text'
    ELSE
      v_part_assignment := 'both';
      v_part_name := NULL;
    END IF;
    
    -- Check stage capabilities
    SELECT 
      supports_multi_specifications, 
      supports_parts,
      name
    INTO v_stage_supports_multi, v_stage_supports_parts, v_stage_name
    FROM production_stages
    WHERE id = (v_stage_record->>'stage_id')::uuid;
    
    RAISE NOTICE '📋 Processing stage "%": % specs, part_type=%, part_assignment=%, supports_multi=%, supports_parts=%',
      v_stage_name, v_spec_count, COALESCE(v_part_type, 'none'), v_part_assignment, v_stage_supports_multi, v_stage_supports_parts;
    
    -- Create ONE job_stage_instance per consolidated stage group
    -- If part_type exists (Cover/Text), this will be a single-spec stage with part_assignment
    -- If part_type is null and multiple specs exist, this may have sub-tasks
    INSERT INTO job_stage_instances (
      job_id,
      job_table_name,
      production_stage_id,
      stage_order,
      status,
      quantity,
      part_assignment,
      part_name,
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
      now(),
      now()
    )
    RETURNING id INTO v_stage_instance_id;
    
    v_created_count := v_created_count + 1;
    RAISE NOTICE '✅ Created stage instance % for stage % (part_assignment=%)', v_stage_instance_id, v_stage_record->>'stage_id', v_part_assignment;
    
    -- LOGIC: Create sub-tasks ONLY if:
    -- 1. Multiple specifications exist AND
    -- 2. Part type is NULL (not Cover/Text scenario) AND
    -- 3. Stage supports multi-specifications
    IF v_spec_count > 1 AND v_part_type IS NULL AND v_stage_supports_multi THEN
      RAISE NOTICE '🔍 Multi-spec scenario detected: creating % sub-tasks', v_spec_count;
      
      v_total_duration := 0;
      
      -- Create stage_sub_tasks for each specification with timing calculation
      FOR v_spec_record IN SELECT * FROM jsonb_array_elements(v_stage_record->'specifications')
      LOOP
        v_quantity := COALESCE((v_spec_record->>'quantity')::integer, 1);
        
        -- Fetch specification timing data if available
        IF (v_spec_record->>'specification_id')::uuid IS NOT NULL THEN
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
            EXCEPTION WHEN OTHERS THEN
              v_spec_duration := 60;
              RAISE WARNING '  ⚠️ Timing calculation failed, using 60min default: %', SQLERRM;
            END;
          ELSE
            v_spec_duration := 60;
          END IF;
        ELSE
          -- No specification ID, use default
          v_spec_duration := 60;
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
        
        RAISE NOTICE '  ✅ Created sub-task #% with duration % mins', v_subtask_count, v_spec_duration;
      END LOOP;
      
      -- Update stage instance with total duration from sub-tasks
      UPDATE job_stage_instances
      SET estimated_duration_minutes = v_total_duration
      WHERE id = v_stage_instance_id;
      
      RAISE NOTICE '✅ Updated stage instance with total duration: % mins (from % sub-tasks)', v_total_duration, v_subtask_count;
    ELSE
      -- Single specification stage OR Cover/Text scenario: set stage_specification_id directly
      IF v_spec_count = 1 THEN
        RAISE NOTICE '📌 Single specification stage - setting stage_specification_id directly (no sub-tasks)';
        UPDATE job_stage_instances
        SET stage_specification_id = (v_stage_record->'specifications'->0->>'specification_id')::uuid
        WHERE id = v_stage_instance_id;
      ELSIF v_part_type IS NOT NULL THEN
        -- This is a Cover/Text part scenario - should always be single spec now due to composite grouping
        -- But if somehow multiple specs exist, set the first one and log a warning
        RAISE WARNING '⚠️ Part-type stage "%" has % specs (expected 1). Using first spec only.', v_part_name, v_spec_count;
        UPDATE job_stage_instances
        SET stage_specification_id = (v_stage_record->'specifications'->0->>'specification_id')::uuid
        WHERE id = v_stage_instance_id;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE '🎯 Workflow initialization complete: % stages, % sub-tasks created', v_created_count, v_subtask_count;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to initialize workflow: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN FALSE;
END;
$function$;

-- Phase 4: Clean up affected jobs (D426821, D426815) to allow re-initialization
-- Delete existing stage instances and sub-tasks for these jobs

DO $$
DECLARE
  v_job_id uuid;
  v_wo_no text;
BEGIN
  -- Find and clean up D426821
  SELECT id, wo_no INTO v_job_id, v_wo_no
  FROM production_jobs
  WHERE wo_no = 'D426821';
  
  IF v_job_id IS NOT NULL THEN
    -- Delete sub-tasks first (foreign key dependency)
    DELETE FROM stage_sub_tasks
    WHERE stage_instance_id IN (
      SELECT id FROM job_stage_instances 
      WHERE job_id = v_job_id AND job_table_name = 'production_jobs'
    );
    
    -- Delete stage instances
    DELETE FROM job_stage_instances
    WHERE job_id = v_job_id AND job_table_name = 'production_jobs';
    
    RAISE NOTICE '🧹 Cleaned up job % (%) - ready for re-initialization', v_wo_no, v_job_id;
  END IF;
  
  -- Find and clean up D426815
  SELECT id, wo_no INTO v_job_id, v_wo_no
  FROM production_jobs
  WHERE wo_no = 'D426815';
  
  IF v_job_id IS NOT NULL THEN
    -- Delete sub-tasks first (foreign key dependency)
    DELETE FROM stage_sub_tasks
    WHERE stage_instance_id IN (
      SELECT id FROM job_stage_instances 
      WHERE job_id = v_job_id AND job_table_name = 'production_jobs'
    );
    
    -- Delete stage instances
    DELETE FROM job_stage_instances
    WHERE job_id = v_job_id AND job_table_name = 'production_jobs';
    
    RAISE NOTICE '🧹 Cleaned up job % (%) - ready for re-initialization', v_wo_no, v_job_id;
  END IF;
END $$;