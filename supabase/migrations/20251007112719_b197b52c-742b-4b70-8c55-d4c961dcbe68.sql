-- Phase 1: Fix initialize_job_stages_with_multi_specs to use REAL timing calculations
-- This removes the hardcoded 60-minute placeholder and calculates accurate durations

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
  v_running_speed numeric;
  v_make_ready_time integer;
  v_speed_unit text;
BEGIN
  RAISE NOTICE '🎯 Starting multi-spec workflow initialization for job %', p_job_id;
  
  -- Iterate through each consolidated stage
  FOR v_stage_record IN SELECT * FROM jsonb_array_elements(p_consolidated_stages)
  LOOP
    -- Check if this stage supports multiple specifications
    SELECT supports_multi_specifications INTO v_stage_supports_multi
    FROM production_stages
    WHERE id = (v_stage_record->>'stage_id')::uuid;
    
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
    
    -- Check if stage has multiple specifications
    IF jsonb_array_length(v_stage_record->'specifications') > 1 AND v_stage_supports_multi THEN
      RAISE NOTICE '🔍 Stage has % specifications, creating sub-tasks with REAL timing', jsonb_array_length(v_stage_record->'specifications');
      
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
            
            RAISE NOTICE '  ✅ Calculated timing: % mins (qty=%, speed=%, makeup=%)', 
              v_spec_duration, v_quantity, v_running_speed, v_make_ready_time;
          EXCEPTION WHEN OTHERS THEN
            -- Fallback to default if calculation fails
            v_spec_duration := 60;
            RAISE WARNING '  ⚠️ Timing calculation failed, using 60min default: %', SQLERRM;
          END;
        ELSE
          -- No timing data available, use default
          v_spec_duration := 60;
          RAISE WARNING '  ⚠️ No timing data for spec %, using 60min default', v_spec_record->>'specification_id';
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
        
        RAISE NOTICE '  ✅ Created sub-task for spec % with duration % mins', 
          v_spec_record->>'specification_id', v_spec_duration;
      END LOOP;
      
      -- Update stage instance with ACCURATE total duration (sum of all sub-tasks)
      UPDATE job_stage_instances
      SET estimated_duration_minutes = v_total_duration
      WHERE id = v_stage_instance_id;
      
      RAISE NOTICE '✅ Updated stage instance with ACCURATE total duration: % mins (from % sub-tasks)', 
        v_total_duration, v_subtask_count;
    ELSE
      -- Single specification stage: set stage_specification_id directly on the instance
      IF jsonb_array_length(v_stage_record->'specifications') = 1 THEN
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
    RAISE EXCEPTION 'Failed to initialize multi-spec workflow: %', SQLERRM;
    RETURN FALSE;
END;
$function$;

-- Phase 4: Create timing synchronization utility for repair/validation
CREATE OR REPLACE FUNCTION public.sync_stage_timing_from_subtasks(p_stage_instance_id uuid)
RETURNS TABLE(
  success boolean,
  stage_id uuid,
  stage_name text,
  subtask_count integer,
  old_duration integer,
  new_duration integer,
  message text
)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_stage record;
  v_subtask record;
  v_total_duration integer := 0;
  v_subtask_count integer := 0;
  v_old_duration integer;
  v_calculated_duration integer;
  v_running_speed numeric;
  v_make_ready_time integer;
  v_speed_unit text;
BEGIN
  -- Get stage details
  SELECT 
    jsi.id,
    jsi.estimated_duration_minutes,
    jsi.production_stage_id,
    ps.name as stage_name
  INTO v_stage
  FROM job_stage_instances jsi
  JOIN production_stages ps ON ps.id = jsi.production_stage_id
  WHERE jsi.id = p_stage_instance_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, p_stage_instance_id, 'Unknown'::text, 0, 0, 0, 'Stage instance not found';
    RETURN;
  END IF;
  
  v_old_duration := v_stage.estimated_duration_minutes;
  
  -- Process all sub-tasks
  FOR v_subtask IN
    SELECT 
      sst.id,
      sst.quantity,
      sst.estimated_duration_minutes,
      sst.stage_specification_id,
      ss.running_speed_per_hour,
      ss.make_ready_time_minutes,
      ss.speed_unit
    FROM stage_sub_tasks sst
    LEFT JOIN stage_specifications ss ON ss.id = sst.stage_specification_id
    WHERE sst.stage_instance_id = p_stage_instance_id
  LOOP
    v_subtask_count := v_subtask_count + 1;
    
    -- If sub-task has no duration or invalid duration, calculate it
    IF COALESCE(v_subtask.estimated_duration_minutes, 0) <= 0 THEN
      IF v_subtask.running_speed_per_hour IS NOT NULL AND v_subtask.running_speed_per_hour > 0 THEN
        BEGIN
          SELECT * INTO v_calculated_duration
          FROM calculate_stage_timing(
            v_subtask.quantity,
            v_subtask.running_speed_per_hour,
            COALESCE(v_subtask.make_ready_time_minutes, 10),
            COALESCE(v_subtask.speed_unit, 'sheets_per_hour')
          );
          
          -- Update sub-task with calculated duration
          UPDATE stage_sub_tasks
          SET estimated_duration_minutes = v_calculated_duration
          WHERE id = v_subtask.id;
          
          v_total_duration := v_total_duration + v_calculated_duration;
        EXCEPTION WHEN OTHERS THEN
          -- Use default if calculation fails
          v_calculated_duration := 60;
          UPDATE stage_sub_tasks
          SET estimated_duration_minutes = 60
          WHERE id = v_subtask.id;
          v_total_duration := v_total_duration + 60;
        END;
      ELSE
        -- No timing data, use default
        UPDATE stage_sub_tasks
        SET estimated_duration_minutes = 60
        WHERE id = v_subtask.id;
        v_total_duration := v_total_duration + 60;
      END IF;
    ELSE
      -- Sub-task already has valid duration
      v_total_duration := v_total_duration + v_subtask.estimated_duration_minutes;
    END IF;
  END LOOP;
  
  -- Update parent stage with accurate sum
  IF v_subtask_count > 0 THEN
    UPDATE job_stage_instances
    SET estimated_duration_minutes = v_total_duration,
        updated_at = now()
    WHERE id = p_stage_instance_id;
    
    RETURN QUERY SELECT 
      true,
      v_stage.id,
      v_stage.stage_name,
      v_subtask_count,
      v_old_duration,
      v_total_duration,
      format('Synced %s sub-tasks: %s → %s mins', v_subtask_count, v_old_duration, v_total_duration);
  ELSE
    RETURN QUERY SELECT 
      false,
      v_stage.id,
      v_stage.stage_name,
      0,
      v_old_duration,
      v_old_duration,
      'No sub-tasks found for this stage';
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.sync_stage_timing_from_subtasks IS 'Synchronizes and repairs timing data for stages with sub-tasks by recalculating from specifications';