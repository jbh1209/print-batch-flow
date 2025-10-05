-- Create new RPC function for multi-specification workflow initialization
-- This handles creating ONE job_stage_instance per unique production_stage_id
-- and MULTIPLE stage_sub_tasks when a stage has multiple specifications

CREATE OR REPLACE FUNCTION public.initialize_job_stages_with_multi_specs(
  p_job_id uuid,
  p_job_table_name text,
  p_consolidated_stages jsonb  -- Array of {stage_id, stage_order, specifications: [{spec_id, quantity, paper}]}
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      RAISE NOTICE '🔍 Stage has % specifications, creating sub-tasks', jsonb_array_length(v_stage_record->'specifications');
      
      v_total_duration := 0;
      
      -- Create stage_sub_tasks for each specification
      FOR v_spec_record IN SELECT * FROM jsonb_array_elements(v_stage_record->'specifications')
      LOOP
        -- Calculate duration for this sub-task using timing service logic
        v_quantity := COALESCE((v_spec_record->>'quantity')::integer, 1);
        
        -- Simple duration calculation (will be refined by timing service later)
        v_spec_duration := 60; -- Default 60 minutes, will be updated by timing calculation
        
        -- Insert sub-task
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
        
        RAISE NOTICE '  ✅ Created sub-task for spec %', v_spec_record->>'specification_id';
      END LOOP;
      
      -- Update stage instance with total duration (sum of all sub-tasks)
      UPDATE job_stage_instances
      SET estimated_duration_minutes = v_total_duration
      WHERE id = v_stage_instance_id;
      
      RAISE NOTICE '✅ Updated stage instance with total duration: % mins', v_total_duration;
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
$$;