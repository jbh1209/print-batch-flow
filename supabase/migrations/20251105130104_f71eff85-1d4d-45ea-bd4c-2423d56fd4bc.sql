-- Restore Oct 24 gap-aware scheduler with part-aware extensions
-- This migration fixes the UV Varnishing multi-day gap issue by:
-- 1. Restoring the working Oct 24 scheduler that clears non-completed slots and rebuilds
-- 2. Extending _stage_tails to be part-aware (stage_id, part_assignment)
-- 3. Implementing parallel resource queues for cover/text parts

-- Drop current version
DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized() CASCADE;

-- Update create_stage_availability_tracker to be part-aware
CREATE OR REPLACE FUNCTION public.create_stage_availability_tracker()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create temporary table for tracking stage availability per part
  DROP TABLE IF EXISTS _stage_tails;
  CREATE TEMPORARY TABLE _stage_tails(
    stage_id uuid NOT NULL,
    part_assignment text NOT NULL DEFAULT 'both',
    next_available_time timestamptz NOT NULL,
    PRIMARY KEY(stage_id, part_assignment)
  ) ON COMMIT DROP;
  
  -- Also track predecessor end times per job (for stage_order dependencies)
  DROP TABLE IF EXISTS _job_stage_ends;
  CREATE TEMPORARY TABLE _job_stage_ends(
    job_id uuid NOT NULL,
    part_assignment text NOT NULL DEFAULT 'both',
    last_end_time timestamptz NOT NULL,
    PRIMARY KEY(job_id, part_assignment)
  ) ON COMMIT DROP;
END;
$$;

-- Restore and enhance scheduler_resource_fill_optimized with part-aware logic
CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  
  r_stage record;
  
  -- Scheduling variables
  resource_tail_cover timestamptz;
  resource_tail_text timestamptz;
  resource_tail timestamptz;
  predecessor_end timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_info jsonb;
  stage_end_time timestamptz;
  
  -- Division filtering
  excluded_stages text[] := ARRAY['PROOF', 'DTP'];
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 42);

  -- Determine base scheduling time (next working start in Africa/Johannesburg)
  base_time := public.next_working_start(
    (now() AT TIME ZONE 'Africa/Johannesburg')::date + interval '1 day'
  );

  RAISE NOTICE '🔄 Starting gap-aware part scheduler from: %', base_time;

  -- STEP 1: Clear existing non-completed slots (enables gap-filling)
  DELETE FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = false;
  RAISE NOTICE '🗑️  Cleared non-completed slots';

  -- STEP 2: Reset scheduling fields on non-completed job_stage_instances
  UPDATE job_stage_instances
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL
  WHERE COALESCE(status, '') NOT IN ('completed', 'active');
  RAISE NOTICE '🔄 Reset scheduling fields on pending stages';

  -- STEP 3: Initialize part-aware stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- STEP 4: Seed _stage_tails from completed slots (per part)
  -- For completed slots, get the part_assignment from job_stage_instances
  INSERT INTO _stage_tails(stage_id, part_assignment, next_available_time)
  SELECT 
    sts.production_stage_id,
    COALESCE(jsi.part_assignment, 'both') as part_assignment,
    MAX(sts.slot_end_time) as next_available
  FROM stage_time_slots sts
  JOIN job_stage_instances jsi ON jsi.id = sts.stage_instance_id
  WHERE COALESCE(sts.is_completed, false) = true
  GROUP BY sts.production_stage_id, COALESCE(jsi.part_assignment, 'both');
  
  -- For stages with completed 'both' assignments, seed both cover and text tails
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
  
  -- Ensure all pending stages have tail entries (initialize to base_time if not present)
  INSERT INTO _stage_tails(stage_id, part_assignment, next_available_time)
  SELECT DISTINCT 
    jsi.production_stage_id,
    COALESCE(jsi.part_assignment, 'both'),
    base_time
  FROM job_stage_instances jsi
  JOIN production_jobs pj ON pj.id = jsi.job_id
  JOIN production_stages ps ON ps.id = jsi.production_stage_id
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
    AND pj.status = 'in_production'
    AND pj.proof_approved_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM unnest(excluded_stages) es
      WHERE UPPER(ps.name) LIKE '%' || es || '%'
    )
  ON CONFLICT (stage_id, part_assignment) DO NOTHING;
  
  -- Seed cover/text tails for 'both' stages if not already present
  INSERT INTO _stage_tails(stage_id, part_assignment, next_available_time)
  SELECT stage_id, 'cover', next_available_time
  FROM _stage_tails
  WHERE part_assignment = 'both'
  ON CONFLICT (stage_id, part_assignment) DO NOTHING;
  
  INSERT INTO _stage_tails(stage_id, part_assignment, next_available_time)
  SELECT stage_id, 'text', next_available_time
  FROM _stage_tails
  WHERE part_assignment = 'both'
  ON CONFLICT (stage_id, part_assignment) DO NOTHING;

  RAISE NOTICE '📊 Seeded _stage_tails with % entries', (SELECT COUNT(*) FROM _stage_tails);

  -- STEP 5: Build scheduling queue ordered by resource availability, proof_approved_at, stage_order
  CREATE TEMPORARY TABLE _scheduling_queue AS
  SELECT
    jsi.id as stage_instance_id,
    jsi.job_id,
    jsi.production_stage_id,
    ps.name as stage_name,
    COALESCE(jsi.stage_order, 999999) as stage_order,
    COALESCE(jsi.part_assignment, 'both') as part_assignment,
    public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) + COALESCE(ps.setup_time_minutes, 0) as total_minutes,
    pj.proof_approved_at,
    pj.wo_no,
    -- Get the earliest resource tail for this stage/part combo
    CASE 
      WHEN COALESCE(jsi.part_assignment, 'both') = 'both' THEN
        GREATEST(
          COALESCE((SELECT next_available_time FROM _stage_tails WHERE stage_id = jsi.production_stage_id AND part_assignment = 'cover'), base_time),
          COALESCE((SELECT next_available_time FROM _stage_tails WHERE stage_id = jsi.production_stage_id AND part_assignment = 'text'), base_time)
        )
      ELSE
        COALESCE(
          (SELECT next_available_time FROM _stage_tails WHERE stage_id = jsi.production_stage_id AND part_assignment = COALESCE(jsi.part_assignment, 'both')),
          base_time
        )
    END as resource_tail
  FROM job_stage_instances jsi
  JOIN production_jobs pj ON pj.id = jsi.job_id
  JOIN production_stages ps ON ps.id = jsi.production_stage_id
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
    AND pj.status = 'in_production'
    AND pj.proof_approved_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM stage_time_slots sts 
      WHERE sts.stage_instance_id = jsi.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM unnest(excluded_stages) es
      WHERE UPPER(ps.name) LIKE '%' || es || '%'
    )
  ORDER BY 
    resource_tail ASC,  -- Schedule on least-busy resource first (fills gaps!)
    proof_approved_at ASC,  -- FIFO by proof approval
    stage_order ASC,  -- Respect stage order
    jsi.id;

  RAISE NOTICE '📋 Scheduling queue: % stages', (SELECT COUNT(*) FROM _scheduling_queue);

  -- STEP 6: Iterate through queue and schedule each stage
  FOR r_stage IN SELECT * FROM _scheduling_queue LOOP
    -- Get resource tail(s) for this stage/part
    IF r_stage.part_assignment = 'both' THEN
      SELECT next_available_time INTO resource_tail_cover
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id AND part_assignment = 'cover';
      
      SELECT next_available_time INTO resource_tail_text
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id AND part_assignment = 'text';
      
      resource_tail := GREATEST(COALESCE(resource_tail_cover, base_time), COALESCE(resource_tail_text, base_time));
    ELSE
      SELECT next_available_time INTO resource_tail
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id AND part_assignment = r_stage.part_assignment;
      
      resource_tail := COALESCE(resource_tail, base_time);
    END IF;

    -- Get predecessor end time (part-aware: predecessor counts if either is 'both' or parts match)
    SELECT COALESCE(MAX(jsi2.scheduled_end_at), base_time)
    INTO predecessor_end
    FROM job_stage_instances jsi2
    WHERE jsi2.job_id = r_stage.job_id
      AND COALESCE(jsi2.stage_order, 999999) < r_stage.stage_order
      AND jsi2.scheduled_end_at IS NOT NULL
      AND (
        jsi2.part_assignment = 'both' 
        OR r_stage.part_assignment = 'both'
        OR jsi2.part_assignment = r_stage.part_assignment
      );
    
    predecessor_end := COALESCE(predecessor_end, base_time);

    -- Calculate earliest start
    stage_earliest_start := GREATEST(
      resource_tail,
      predecessor_end,
      r_stage.proof_approved_at,
      base_time
    );

    -- Add diagnostics for UV Varnishing stages
    IF r_stage.stage_name ILIKE '%varnish%' THEN
      RAISE NOTICE '🔍 UV VARNISH DEBUG: Job=%, Part=%, ResourceTail=%, PredEnd=%, EarliestStart=%',
        r_stage.wo_no, r_stage.part_assignment, resource_tail, predecessor_end, stage_earliest_start;
    END IF;

    -- Use place_duration_sql to find working-window compliant slots
    SELECT * INTO placement_result
    FROM public.place_duration_sql(stage_earliest_start, r_stage.total_minutes);
    
    IF placement_result.placement_success THEN
      -- Create time slots
      FOR slot_info IN SELECT * FROM jsonb_array_elements(placement_result.slots_created) LOOP
        INSERT INTO stage_time_slots(
          production_stage_id,
          date,
          slot_start_time,
          slot_end_time,
          duration_minutes,
          job_id,
          job_table_name,
          stage_instance_id,
          is_completed
        )
        VALUES (
          r_stage.production_stage_id,
          (slot_info ->> 'date')::date,
          (slot_info ->> 'start_time')::timestamptz,
          (slot_info ->> 'end_time')::timestamptz,
          (slot_info ->> 'duration_minutes')::integer,
          r_stage.job_id,
          'production_jobs',
          r_stage.stage_instance_id,
          false
        );
        wrote_count := wrote_count + 1;
      END LOOP;

      -- Get the final end time
      SELECT MAX((slot_info ->> 'end_time')::timestamptz)
      INTO stage_end_time
      FROM jsonb_array_elements(placement_result.slots_created) slot_info;

      -- Update job_stage_instances
      UPDATE job_stage_instances
      SET 
        scheduled_minutes = r_stage.total_minutes,
        scheduled_start_at = (
          SELECT MIN((slot_info ->> 'start_time')::timestamptz)
          FROM jsonb_array_elements(placement_result.slots_created) slot_info
        ),
        scheduled_end_at = stage_end_time,
        schedule_status = 'scheduled',
        updated_at = now()
      WHERE id = r_stage.stage_instance_id;
      updated_count := updated_count + 1;

      -- Update _stage_tails based on part_assignment
      IF r_stage.part_assignment = 'both' THEN
        -- 'both' occupies both cover and text queues
        UPDATE _stage_tails 
        SET next_available_time = stage_end_time
        WHERE stage_id = r_stage.production_stage_id 
          AND part_assignment IN ('cover', 'text', 'both');
      ELSE
        -- Update only the matching part queue
        UPDATE _stage_tails 
        SET next_available_time = stage_end_time
        WHERE stage_id = r_stage.production_stage_id 
          AND part_assignment = r_stage.part_assignment;
      END IF;

      IF r_stage.stage_name ILIKE '%varnish%' THEN
        RAISE NOTICE '✅ UV VARNISH SCHEDULED: Job=%, ScheduledEnd=%', r_stage.wo_no, stage_end_time;
      END IF;
    ELSE
      RAISE WARNING '❌ Failed to schedule stage % for job % (% minutes)',
        r_stage.stage_name, r_stage.wo_no, r_stage.total_minutes;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Gap-aware part scheduler complete: wrote % slots, updated % stages', wrote_count, updated_count;

  RETURN jsonb_build_object(
    'wrote_slots', wrote_count,
    'updated_jsi', updated_count
  );
END;
$$;

COMMENT ON FUNCTION public.scheduler_resource_fill_optimized() IS 
'Gap-aware part-parallel scheduler. Clears non-completed slots, rebuilds schedule from base time, uses _stage_tails per (stage_id, part_assignment) to enable cover/text parallelism and gap-filling.';