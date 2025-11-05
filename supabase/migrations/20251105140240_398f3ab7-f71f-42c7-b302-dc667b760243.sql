-- Fix next_working_start type signature error
-- Change line 30 to pass timestamptz directly instead of converting with AT TIME ZONE

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
  stage_earliest_start timestamptz;
  predecessor_end_time timestamptz;
  resource_available_time timestamptz;
  placement_result jsonb;
  slot_rec jsonb;
  wrote_slots int := 0;
  updated_jsi int := 0;
  stage_end_time timestamptz;
BEGIN
  -- Lock to prevent concurrent runs
  PERFORM pg_advisory_xact_lock(123456789);
  
  RAISE NOTICE '=== SCHEDULER START ===';
  
  -- Get base time (next working day start) - FIXED: pass timestamptz directly
  SELECT public.next_working_start(now(), 'Africa/Johannesburg')
  INTO base_time;
  
  RAISE NOTICE 'Base time: %', base_time;
  
  -- Clear pending/proposed slots (keep completed and active)
  DELETE FROM stage_time_slots sts
  USING job_stage_instances jsi
  WHERE sts.stage_instance_id = jsi.id
    AND jsi.status NOT IN ('completed', 'active');
  
  -- Reset scheduling fields for pending stages
  UPDATE job_stage_instances
  SET scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = NULL,
      schedule_status = NULL
  WHERE status NOT IN ('completed', 'active');
  
  -- Create part-aware temporary tables
  PERFORM public.create_stage_availability_tracker();
  
  CREATE TEMP TABLE IF NOT EXISTS _job_stage_ends (
    job_id uuid,
    part_assignment text DEFAULT 'both',
    last_end_time timestamptz,
    PRIMARY KEY (job_id, part_assignment)
  ) ON COMMIT DROP;
  
  RAISE NOTICE 'Temporary tables created';
  
  -- Seed resource tails from completed work, per (stage, part)
  INSERT INTO _stage_tails(stage_id, part_assignment, next_available_time)
  SELECT 
    sts.production_stage_id,
    COALESCE(jsi.part_assignment, 'both'),
    GREATEST(MAX(sts.slot_end_time), base_time)
  FROM stage_time_slots sts
  JOIN job_stage_instances jsi ON jsi.id = sts.stage_instance_id
  WHERE sts.is_completed = true
  GROUP BY sts.production_stage_id, jsi.part_assignment;
  
  -- For completed 'both' stages, also seed cover and text tails
  INSERT INTO _stage_tails(stage_id, part_assignment, next_available_time)
  SELECT stage_id, 'cover', next_available_time
  FROM _stage_tails
  WHERE part_assignment = 'both'
  ON CONFLICT (stage_id, part_assignment) DO UPDATE 
    SET next_available_time = GREATEST(_stage_tails.next_available_time, EXCLUDED.next_available_time);
  
  INSERT INTO _stage_tails(stage_id, part_assignment, next_available_time)
  SELECT stage_id, 'text', next_available_time
  FROM _stage_tails
  WHERE part_assignment = 'both'
  ON CONFLICT (stage_id, part_assignment) DO UPDATE 
    SET next_available_time = GREATEST(_stage_tails.next_available_time, EXCLUDED.next_available_time);
  
  -- Ensure all (stage, part) combos exist for pending work
  INSERT INTO _stage_tails(stage_id, part_assignment, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, COALESCE(jsi.part_assignment, 'both'), base_time
  FROM job_stage_instances jsi
  WHERE jsi.status NOT IN ('completed', 'active')
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Resource tails seeded';
  
  -- Loop through scheduling queue
  FOR r_stage IN
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.stage_order,
      jsi.part_assignment,
      public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) 
        + COALESCE(jsi.setup_time_minutes, 0) as total_minutes,
      ps.name as stage_name,
      pj.wo_no,
      pj.proof_approved_at,
      (CASE 
        WHEN jsi.part_assignment = 'both' THEN
          GREATEST(
            COALESCE((SELECT next_available_time FROM _stage_tails WHERE stage_id = jsi.production_stage_id AND part_assignment = 'cover'), base_time),
            COALESCE((SELECT next_available_time FROM _stage_tails WHERE stage_id = jsi.production_stage_id AND part_assignment = 'text'), base_time)
          )
        ELSE
          COALESCE((SELECT next_available_time FROM _stage_tails WHERE stage_id = jsi.production_stage_id AND part_assignment = jsi.part_assignment), base_time)
      END) as resource_available_time
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.status NOT IN ('completed', 'active')
      AND jsi.job_table_name = 'production_jobs'
      AND pj.proof_approved_at IS NOT NULL
      AND ps.name NOT ILIKE '%DTP%' 
      AND ps.name NOT ILIKE '%PROOF%'
    ORDER BY 
      pj.proof_approved_at ASC,
      jsi.stage_order ASC,
      resource_available_time ASC,
      jsi.id ASC
  LOOP
    resource_available_time := r_stage.resource_available_time;
    
    -- Find max predecessor end time considering part logic
    SELECT COALESCE(MAX(jse.last_end_time), base_time) INTO predecessor_end_time
    FROM _job_stage_ends jse
    WHERE jse.job_id = r_stage.job_id
      AND (
        jse.part_assignment = 'both' 
        OR r_stage.part_assignment = 'both'
        OR jse.part_assignment = r_stage.part_assignment
      );
    
    -- Earliest start is the latest of: resource available, predecessor done, proof approved, base time
    stage_earliest_start := GREATEST(
      resource_available_time,
      predecessor_end_time,
      r_stage.proof_approved_at,
      base_time
    );
    
    -- Debug for varnish stages
    IF r_stage.stage_name ILIKE '%varnish%' THEN
      RAISE NOTICE '🔍 VARNISH DEBUG: stage=%, part=%, resource_tail=%, pred_end=%, earliest=%, total_mins=%',
        r_stage.stage_instance_id, r_stage.part_assignment, resource_available_time, 
        predecessor_end_time, stage_earliest_start, r_stage.total_minutes;
    END IF;
    
    -- Place this stage using the working-window scheduler
    placement_result := public.place_duration_sql(
      stage_earliest_start,
      r_stage.total_minutes
    );
    
    -- Extract end time
    stage_end_time := (placement_result->>'end_time')::timestamptz;
    
    -- Insert slots from placement result
    FOR slot_rec IN SELECT * FROM jsonb_array_elements(placement_result->'slots')
    LOOP
      INSERT INTO stage_time_slots (
        production_stage_id,
        stage_instance_id,
        job_id,
        job_table_name,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        date,
        is_completed
      ) VALUES (
        r_stage.production_stage_id,
        r_stage.stage_instance_id,
        r_stage.job_id,
        'production_jobs',
        (slot_rec->>'start')::timestamptz,
        (slot_rec->>'end')::timestamptz,
        (slot_rec->>'minutes')::int,
        (slot_rec->>'start')::date,
        false
      );
      wrote_slots := wrote_slots + 1;
    END LOOP;
    
    -- Update job_stage_instances with schedule
    UPDATE job_stage_instances
    SET scheduled_start_at = (placement_result->'slots'->0->>'start')::timestamptz,
        scheduled_end_at = stage_end_time,
        scheduled_minutes = r_stage.total_minutes,
        schedule_status = 'scheduled'
    WHERE id = r_stage.stage_instance_id;
    
    updated_jsi := updated_jsi + 1;
    
    -- Update the appropriate part tail(s)
    IF r_stage.part_assignment = 'both' THEN
      -- 'both' blocks both cover and text queues
      UPDATE _stage_tails 
      SET next_available_time = stage_end_time
      WHERE stage_id = r_stage.production_stage_id 
        AND part_assignment IN ('cover', 'text', 'both');
    ELSE
      -- Only update the specific part queue
      UPDATE _stage_tails 
      SET next_available_time = stage_end_time
      WHERE stage_id = r_stage.production_stage_id 
        AND part_assignment = r_stage.part_assignment;
    END IF;
    
    -- Record this stage's end for predecessor tracking
    INSERT INTO _job_stage_ends (job_id, part_assignment, last_end_time)
    VALUES (r_stage.job_id, COALESCE(r_stage.part_assignment, 'both'), stage_end_time)
    ON CONFLICT (job_id, part_assignment) DO UPDATE 
      SET last_end_time = GREATEST(_job_stage_ends.last_end_time, EXCLUDED.last_end_time);
    
  END LOOP;
  
  RAISE NOTICE '=== SCHEDULER COMPLETE: wrote_slots=%, updated_jsi=% ===', wrote_slots, updated_jsi;
  
  RETURN jsonb_build_object(
    'wrote_slots', wrote_slots,
    'updated_jsi', updated_jsi
  );
END;
$$;

COMMENT ON FUNCTION public.scheduler_resource_fill_optimized() IS 
'Part-aware gap-filling scheduler that properly uses (stage_id, part_assignment) composite key for resource tails';