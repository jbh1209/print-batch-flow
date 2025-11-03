-- CRITICAL FIX: Remove PROOF/DTP stages from scheduling completely
-- This migration implements defense-in-depth to ensure PROOF/DTP never get scheduled

-- Step 1: Clean up existing PROOF/DTP scheduled times immediately
UPDATE job_stage_instances jsi
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = NULL,
  schedule_status = NULL,
  updated_at = now()
FROM production_stages ps
WHERE jsi.production_stage_id = ps.id
  AND (ps.name ILIKE '%proof%' OR ps.name ILIKE '%dtp%')
  AND (jsi.scheduled_start_at IS NOT NULL OR jsi.scheduled_end_at IS NOT NULL);

-- Step 2: Create monitoring view to detect any PROOF/DTP with scheduling data
CREATE OR REPLACE VIEW v_non_schedulable_with_times AS
SELECT 
  jsi.id as stage_instance_id,
  pj.wo_no,
  ps.name as stage_name,
  jsi.status,
  jsi.scheduled_start_at,
  jsi.scheduled_end_at,
  jsi.scheduled_minutes,
  jsi.schedule_status,
  jsi.updated_at
FROM job_stage_instances jsi
JOIN production_stages ps ON ps.id = jsi.production_stage_id
JOIN production_jobs pj ON pj.id = jsi.job_id
WHERE (ps.name ILIKE '%proof%' OR ps.name ILIKE '%dtp%')
  AND (jsi.scheduled_start_at IS NOT NULL 
       OR jsi.scheduled_end_at IS NOT NULL 
       OR jsi.scheduled_minutes IS NOT NULL
       OR jsi.schedule_status IS NOT NULL);

COMMENT ON VIEW v_non_schedulable_with_times IS 
  'Monitoring view: Shows PROOF/DTP stages that incorrectly have scheduling data. Should always be empty.';

-- Step 3: Create trigger to prevent PROOF/DTP from ever getting scheduling data
CREATE OR REPLACE FUNCTION trg_prevent_proof_dtp_scheduling()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  stage_name text;
BEGIN
  -- Get the stage name
  SELECT name INTO stage_name
  FROM production_stages
  WHERE id = NEW.production_stage_id;
  
  -- If this is a PROOF or DTP stage, force scheduling fields to NULL
  IF stage_name ILIKE '%proof%' OR stage_name ILIKE '%dtp%' THEN
    NEW.scheduled_start_at := NULL;
    NEW.scheduled_end_at := NULL;
    NEW.scheduled_minutes := NULL;
    NEW.schedule_status := NULL;
    
    RAISE NOTICE 'PROOF/DTP stage % (%) - scheduling fields forced to NULL', stage_name, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_prevent_proof_dtp_scheduling ON job_stage_instances;

CREATE TRIGGER trg_prevent_proof_dtp_scheduling
  BEFORE INSERT OR UPDATE ON job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION trg_prevent_proof_dtp_scheduling();

COMMENT ON FUNCTION trg_prevent_proof_dtp_scheduling() IS
  'Prevents PROOF/DTP stages from ever receiving scheduling data by forcing fields to NULL';

-- Step 4: Update scheduler_resource_fill_optimized to explicitly exclude PROOF/DTP
CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized()
 RETURNS scheduler_result_type
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  result_record scheduler_result_type;
  
  -- Job processing variables
  r_job record;
  r_stage record;
  
  -- Scheduling variables
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 43);

  -- FIXED: Time-aware base scheduling time calculation
  -- If current time is before shift start (8 AM), schedule for same day
  -- If current time is after shift start, schedule for next working day
  IF EXTRACT(HOUR FROM now()) < 8 THEN
    -- Before shift start - schedule for today at next shift start
    base_time := public.next_working_start(date_trunc('day', now()));
    RAISE NOTICE 'RESOURCE-FILL Running before shift start - scheduling for same day: %', base_time;
  ELSE
    -- After shift start - schedule for next working day
    base_time := public.next_working_start(date_trunc('day', now()) + interval '1 day');
    RAISE NOTICE 'RESOURCE-FILL Running after shift start - scheduling for next working day: %', base_time;
  END IF;

  RAISE NOTICE 'RESOURCE-FILL Starting scheduler from: %', base_time;

  -- Clear existing non-completed slots
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  RAISE NOTICE 'RESOURCE-FILL Cleared existing non-completed time slots';

  -- Clear scheduling data for non-completed stages
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE COALESCE(status, '') NOT IN ('completed', 'active');
  
  RAISE NOTICE 'RESOURCE-FILL Cleared scheduling data from non-completed job_stage_instances';

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize stages to base_time, accounting for completed work
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    GREATEST(
      COALESCE(MAX(slot_end_time), base_time),
      base_time
    )
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- Initialize any stages not yet tracked (EXCLUDING PROOF/DTP)
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  JOIN production_stages ps ON ps.id = jsi.production_stage_id
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
    AND ps.name NOT ILIKE '%proof%'
    AND ps.name NOT ILIKE '%dtp%'
  ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE 'RESOURCE-FILL Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- Process stages by resource availability (RESOURCE-FILL strategy)
  -- CRITICAL FIX: Only schedule proof-approved jobs AND exclude PROOF/DTP stages
  FOR r_stage IN
    WITH stage_queue AS (
      SELECT 
        jsi.id as stage_instance_id,
        jsi.job_id,
        jsi.production_stage_id,
        jsi.stage_order,
        public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
        ps.name as stage_name,
        pj.wo_no,
        pj.proof_approved_at,
        st.next_available_time as resource_available_time
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      JOIN production_jobs pj ON pj.id = jsi.job_id
      JOIN _stage_tails st ON st.stage_id = jsi.production_stage_id
      WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
        AND jsi.job_table_name = 'production_jobs'
        AND pj.proof_approved_at IS NOT NULL
        AND ps.name NOT ILIKE '%proof%'
        AND ps.name NOT ILIKE '%dtp%'
      ORDER BY 
        st.next_available_time ASC,
        pj.proof_approved_at ASC,
        jsi.stage_order ASC,
        jsi.id ASC
    )
    SELECT * FROM stage_queue
  LOOP
    -- Get current resource availability
    SELECT next_available_time INTO resource_available_time
    FROM _stage_tails 
    WHERE stage_id = r_stage.production_stage_id
    FOR UPDATE;

    -- Calculate earliest possible start time
    stage_earliest_start := GREATEST(
      resource_available_time,
      COALESCE(r_stage.proof_approved_at, base_time),
      base_time
    );

    RAISE NOTICE 'RESOURCE-FILL Scheduling stage % (%): % mins from % (resource avail: %)',
      r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
      stage_earliest_start, resource_available_time;

    -- Calculate placement for this stage
    SELECT * INTO placement_result 
    FROM public.place_stage_duration_v2(
      r_stage.production_stage_id,
      stage_earliest_start,
      r_stage.duration_minutes
    );
    
    -- Calculate end time
    stage_end_time := placement_result.calculated_end_time;

    -- Create slot record
    slot_record := jsonb_build_object(
      'stage_instance_id', r_stage.stage_instance_id,
      'production_stage_id', r_stage.production_stage_id,
      'slot_start_time', placement_result.calculated_start_time,
      'slot_end_time', stage_end_time,
      'duration_minutes', r_stage.duration_minutes,
      'is_completed', false,
      'scheduled_by', 'scheduler_resource_fill_optimized',
      'created_at', now()
    );

    -- Insert the time slot
    INSERT INTO stage_time_slots (
      stage_instance_id,
      production_stage_id, 
      slot_start_time,
      slot_end_time,
      duration_minutes,
      is_completed,
      scheduled_by,
      created_at
    )
    VALUES (
      r_stage.stage_instance_id,
      r_stage.production_stage_id,
      placement_result.calculated_start_time,
      stage_end_time,
      r_stage.duration_minutes,
      false,
      'scheduler_resource_fill_optimized',
      now()
    );

    wrote_count := wrote_count + 1;

    -- Update job stage instance
    UPDATE job_stage_instances SET
      scheduled_start_at = placement_result.calculated_start_time,
      scheduled_end_at = stage_end_time,
      scheduled_minutes = r_stage.duration_minutes,
      schedule_status = 'scheduled',
      updated_at = now()
    WHERE id = r_stage.stage_instance_id;
    
    updated_count := updated_count + 1;

    -- Update resource availability for this stage
    UPDATE _stage_tails 
    SET next_available_time = stage_end_time
    WHERE stage_id = r_stage.production_stage_id;

    RAISE NOTICE 'RESOURCE-FILL Placed stage % from % to % (% mins)',
      r_stage.stage_name, placement_result.calculated_start_time, 
      stage_end_time, r_stage.duration_minutes;

  END LOOP;

  -- Clean up the temporary tracker
  PERFORM public.cleanup_stage_availability_tracker();
  
  RAISE NOTICE 'RESOURCE-FILL Completed: % slots written, % stages updated', wrote_count, updated_count;
  
  -- Build result
  result_record.wroteSlots := wrote_count;
  result_record.updatedJSI := updated_count;
  result_record.dryRun := false;
  result_record.violations := validation_results;
  
  RETURN result_record;
END;
$function$;