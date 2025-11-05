-- Fix parallel processing: Only wait for predecessors in the same part path
-- This ensures Cover and Text stages can truly process in parallel

DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized() CASCADE;

CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_time timestamptz;
  r_stage RECORD;
  slot_start timestamptz;
  slot_end timestamptz;
  total_minutes integer;
  stage_earliest_start timestamptz;
  predecessor_end_time timestamptz;
  updated_count integer := 0;
  wrote_slots_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting scheduler_resource_fill_optimized';
  
  -- Set base time to start of next working day
  base_time := date_trunc('day', now() AT TIME ZONE 'Africa/Johannesburg') + interval '1 day' + interval '8 hours';
  
  -- Track stage completion times per job (NOW WITH PART ASSIGNMENT)
  CREATE TEMP TABLE IF NOT EXISTS _job_stage_ends (
    job_id uuid,
    stage_instance_id uuid,
    stage_order integer,
    part_assignment text,
    scheduled_end_at timestamptz,
    PRIMARY KEY (stage_instance_id)
  ) ON COMMIT DROP;
  
  -- Track resource availability
  CREATE TEMP TABLE IF NOT EXISTS _resource_next_available (
    production_stage_id uuid PRIMARY KEY,
    next_available_time timestamptz
  ) ON COMMIT DROP;

  -- Process stages in correct order: by proof approval, then stage order, then resource availability
  FOR r_stage IN
    WITH stage_queue AS (
      SELECT 
        jsi.id,
        jsi.job_id,
        jsi.production_stage_id,
        jsi.stage_order,
        jsi.part_assignment,
        COALESCE(jsi.estimated_minutes, 0) + COALESCE(jsi.setup_minutes, 0) AS total_minutes,
        pj.proof_approved_at,
        COALESCE(st.next_available_time, base_time) AS resource_available_at
      FROM job_stage_instances jsi
      JOIN production_jobs pj ON pj.id = jsi.job_id
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      LEFT JOIN _resource_next_available st ON st.production_stage_id = jsi.production_stage_id
      WHERE jsi.status IN ('pending', 'active')
        AND jsi.scheduled_start_at IS NULL
        AND pj.proof_approved_at IS NOT NULL
        AND ps.name NOT ILIKE '%proof%'
        AND ps.name NOT ILIKE '%dtp%'
    )
    SELECT * FROM stage_queue
    ORDER BY proof_approved_at ASC, stage_order ASC, resource_available_at ASC, id ASC
  LOOP
    -- Find max predecessor end time IN THE SAME PART PATH
    SELECT COALESCE(MAX(jse.scheduled_end_at), base_time) INTO predecessor_end_time
    FROM _job_stage_ends jse
    WHERE jse.job_id = r_stage.job_id
      AND jse.stage_order < r_stage.stage_order
      AND (
        -- If current stage is 'both', wait for all predecessors
        r_stage.part_assignment = 'both'
        OR
        -- If current stage is part-specific, only wait for matching part predecessors
        (r_stage.part_assignment IN ('cover', 'text') AND
         (jse.part_assignment = r_stage.part_assignment OR jse.part_assignment = 'both'))
      );
    
    -- Calculate earliest start time
    stage_earliest_start := GREATEST(
      COALESCE((SELECT next_available_time FROM _resource_next_available WHERE production_stage_id = r_stage.production_stage_id), base_time),
      COALESCE(r_stage.proof_approved_at, base_time),
      COALESCE(predecessor_end_time, base_time),
      base_time
    );
    
    -- Set slot times
    slot_start := stage_earliest_start;
    total_minutes := GREATEST(r_stage.total_minutes, 0);
    slot_end := slot_start + (total_minutes || ' minutes')::interval;
    
    -- Update the stage instance
    UPDATE job_stage_instances
    SET 
      scheduled_start_at = slot_start,
      scheduled_end_at = slot_end,
      scheduled_minutes = total_minutes
    WHERE id = r_stage.id;
    
    updated_count := updated_count + 1;
    
    -- Track this stage's completion time (INCLUDING PART ASSIGNMENT)
    INSERT INTO _job_stage_ends (job_id, stage_instance_id, stage_order, part_assignment, scheduled_end_at)
    VALUES (r_stage.job_id, r_stage.id, r_stage.stage_order, r_stage.part_assignment, slot_end);
    
    -- Update resource availability
    INSERT INTO _resource_next_available (production_stage_id, next_available_time)
    VALUES (r_stage.production_stage_id, slot_end)
    ON CONFLICT (production_stage_id) 
    DO UPDATE SET next_available_time = EXCLUDED.next_available_time;
    
  END LOOP;
  
  RAISE NOTICE 'Scheduler completed. Updated % stages', updated_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_jsi', updated_count,
    'wrote_slots', wrote_slots_count
  );
END;
$$;