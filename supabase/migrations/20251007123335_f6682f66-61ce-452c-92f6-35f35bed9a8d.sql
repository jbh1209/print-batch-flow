
-- Fix the repair function to handle boolean return properly
CREATE OR REPLACE FUNCTION repair_handwork_stage_timings()
RETURNS TABLE(
  stage_instance_id uuid,
  wo_no text,
  stage_name text,
  old_duration integer,
  new_duration integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage record;
  v_sync_success boolean;
  v_new_duration integer;
BEGIN
  FOR v_stage IN
    SELECT 
      jsi.id,
      pj.wo_no,
      ps.name,
      jsi.estimated_duration_minutes
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE ps.name = 'Handwork'
      AND jsi.status IN ('pending', 'scheduled')
      AND EXISTS (
        SELECT 1 FROM stage_sub_tasks sst 
        WHERE sst.stage_instance_id = jsi.id
      )
    ORDER BY pj.wo_no
  LOOP
    BEGIN
      -- Call the sync function (returns boolean)
      SELECT * INTO v_sync_success 
      FROM sync_stage_timing_from_subtasks(v_stage.id);
      
      IF v_sync_success THEN
        -- Fetch the updated duration
        SELECT estimated_duration_minutes INTO v_new_duration
        FROM job_stage_instances
        WHERE id = v_stage.id;
        
        RETURN QUERY SELECT 
          v_stage.id,
          v_stage.wo_no,
          v_stage.name,
          v_stage.estimated_duration_minutes,
          v_new_duration,
          'fixed'::text;
      ELSE
        RETURN QUERY SELECT 
          v_stage.id,
          v_stage.wo_no,
          v_stage.name,
          v_stage.estimated_duration_minutes,
          NULL::integer,
          'sync_failed'::text;
      END IF;
        
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        v_stage.id,
        v_stage.wo_no,
        v_stage.name,
        v_stage.estimated_duration_minutes,
        NULL::integer,
        ('error: ' || SQLERRM)::text;
    END;
  END LOOP;
END;
$$;

-- Run the repair and show results
SELECT * FROM repair_handwork_stage_timings();
