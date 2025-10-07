-- Create a function to repair stage sub-task durations
CREATE OR REPLACE FUNCTION repair_stage_sub_task_durations()
RETURNS TABLE(
  repaired_stage_id uuid,
  wo_no text,
  stage_name text,
  old_duration integer,
  new_duration integer,
  sub_task_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_stage record;
  v_subtask record;
  v_total_duration integer;
  v_subtask_duration integer;
  v_subtask_count integer;
  v_old_duration integer;
BEGIN
  -- Find all stages with sub-tasks that have invalid durations
  FOR v_stage IN
    SELECT DISTINCT
      jsi.id as stage_id,
      jsi.estimated_duration_minutes,
      jsi.production_stage_id,
      ps.name as stage_name,
      pj.wo_no,
      pj.id as job_id
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    LEFT JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.status IN ('pending', 'on_hold', 'scheduled')
      AND EXISTS (
        SELECT 1 FROM stage_sub_tasks sst
        WHERE sst.stage_instance_id = jsi.id
      )
      AND (jsi.estimated_duration_minutes IS NULL OR jsi.estimated_duration_minutes <= 0)
  LOOP
    v_total_duration := 0;
    v_subtask_count := 0;
    v_old_duration := v_stage.estimated_duration_minutes;
    
    -- Calculate duration for each sub-task
    FOR v_subtask IN
      SELECT 
        sst.id,
        sst.quantity,
        sst.estimated_duration_minutes as current_duration,
        ss.running_speed_per_hour,
        ss.make_ready_time_minutes,
        ss.speed_unit
      FROM stage_sub_tasks sst
      LEFT JOIN stage_specifications ss ON ss.id = sst.stage_specification_id
      WHERE sst.stage_instance_id = v_stage.stage_id
    LOOP
      v_subtask_count := v_subtask_count + 1;
      
      -- Calculate duration using the same logic as the timing service
      IF v_subtask.running_speed_per_hour IS NOT NULL AND v_subtask.running_speed_per_hour > 0 THEN
        -- Call the calculate_stage_timing RPC function
        BEGIN
          SELECT * INTO v_subtask_duration
          FROM calculate_stage_timing(
            v_subtask.quantity,
            v_subtask.running_speed_per_hour,
            COALESCE(v_subtask.make_ready_time_minutes, 10),
            COALESCE(v_subtask.speed_unit, 'sheets_per_hour')
          );
        EXCEPTION WHEN OTHERS THEN
          -- Fallback: use simple calculation
          v_subtask_duration := COALESCE(v_subtask.make_ready_time_minutes, 10) + 
                                CEIL((v_subtask.quantity::numeric / NULLIF(v_subtask.running_speed_per_hour, 0)) * 60);
        END;
      ELSE
        -- No timing data, use current duration or default to 60 minutes
        v_subtask_duration := COALESCE(v_subtask.current_duration, 60);
      END IF;
      
      -- Update the sub-task with calculated duration
      UPDATE stage_sub_tasks
      SET estimated_duration_minutes = v_subtask_duration
      WHERE id = v_subtask.id;
      
      v_total_duration := v_total_duration + v_subtask_duration;
      
      RAISE NOTICE '  Sub-task: % mins (quantity: %, speed: %)', 
        v_subtask_duration, v_subtask.quantity, v_subtask.running_speed_per_hour;
    END LOOP;
    
    -- Update the parent stage instance with total duration
    IF v_total_duration > 0 THEN
      UPDATE job_stage_instances
      SET 
        estimated_duration_minutes = v_total_duration,
        updated_at = now()
      WHERE id = v_stage.stage_id;
      
      RAISE NOTICE 'Repaired stage % for job %: old=%, new=%, sub_tasks=%',
        v_stage.stage_name, v_stage.wo_no, v_old_duration, v_total_duration, v_subtask_count;
      
      -- Return the repair information
      RETURN QUERY SELECT 
        v_stage.stage_id,
        v_stage.wo_no,
        v_stage.stage_name,
        v_old_duration,
        v_total_duration,
        v_subtask_count;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Execute the repair immediately
DO $$
DECLARE
  v_repair_count integer := 0;
  v_result record;
BEGIN
  RAISE NOTICE 'Starting repair of stage sub-task durations...';
  
  FOR v_result IN SELECT * FROM repair_stage_sub_task_durations()
  LOOP
    v_repair_count := v_repair_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Repair complete: % stages fixed', v_repair_count;
END;
$$;