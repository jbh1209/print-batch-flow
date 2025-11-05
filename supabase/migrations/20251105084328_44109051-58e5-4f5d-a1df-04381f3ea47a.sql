-- Fix scheduler to honor predecessor stage completion times
-- Critical bug: stages were scheduled in parallel even though they must be sequential

-- Drop and recreate the function with predecessor dependency tracking
DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized();

CREATE FUNCTION public.scheduler_resource_fill_optimized() RETURNS public.scheduler_result_type
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
  predecessor_end_time timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 43);

  -- Determine base scheduling time (next working day)
  base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');

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

  -- Create temporary table to track stage completion times per job
  CREATE TEMP TABLE IF NOT EXISTS _job_stage_ends (
    job_id uuid,
    stage_instance_id uuid,
    stage_order integer,
    scheduled_end_at timestamptz,
    PRIMARY KEY (stage_instance_id)
  ) ON COMMIT DROP;

  -- Clear it if it already existed
  TRUNCATE _job_stage_ends;

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

  -- Initialize any stages not yet tracked
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
  ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE 'RESOURCE-FILL Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- CRITICAL FIX: Process stages job-by-job, respecting stage_order
  -- This ensures all predecessors are scheduled before dependents
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
      ORDER BY 
        pj.proof_approved_at ASC,    -- Process jobs in FIFO order
        jsi.stage_order ASC,         -- Then stages in sequence within each job
        st.next_available_time ASC,  -- Then by resource availability
        jsi.id ASC
    )
    SELECT * FROM stage_queue
  LOOP
    -- Get current resource availability
    SELECT next_available_time INTO resource_available_time
    FROM _stage_tails 
    WHERE stage_id = r_stage.production_stage_id
    FOR UPDATE;

    -- CRITICAL FIX: Find the maximum end time of all predecessor stages
    -- (stages in the same job with lower stage_order)
    SELECT COALESCE(MAX(jse.scheduled_end_at), base_time) INTO predecessor_end_time
    FROM _job_stage_ends jse
    WHERE jse.job_id = r_stage.job_id
      AND jse.stage_order < r_stage.stage_order;

    -- Calculate earliest possible start time
    -- Now includes predecessor completion time!
    stage_earliest_start := GREATEST(
      resource_available_time,
      COALESCE(r_stage.proof_approved_at, base_time),
      COALESCE(predecessor_end_time, base_time),
      base_time
    );

    RAISE NOTICE 'RESOURCE-FILL Scheduling stage % (%): % mins from % (resource: %, predecessor: %)',
      r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
      stage_earliest_start, resource_available_time, predecessor_end_time;

    -- Place the duration using SQL placement function
    SELECT * INTO placement_result
    FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
    
    IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
      RAISE WARNING 'RESOURCE-FILL Failed to schedule stage % (%) - placement failed at %',
        r_stage.stage_name, r_stage.stage_instance_id, stage_earliest_start;
      CONTINUE;
    END IF;

    IF jsonb_array_length(placement_result.slots_created) = 0 THEN
      RAISE WARNING 'RESOURCE-FILL Failed to schedule stage % (%) - no slots created',
        r_stage.stage_name, r_stage.stage_instance_id;
      CONTINUE;
    END IF;

    -- Create time slots from placement result
    FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
    LOOP
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
        (slot_record ->> 'date')::date,
        (slot_record ->> 'start_time')::timestamptz,
        (slot_record ->> 'end_time')::timestamptz,
        (slot_record ->> 'duration_minutes')::integer,
        r_stage.job_id,
        'production_jobs',
        r_stage.stage_instance_id,
        false
      );
      wrote_count := wrote_count + 1;
    END LOOP;

    -- Calculate stage end time
    SELECT MAX((time_slot ->> 'end_time')::timestamptz)
    INTO stage_end_time
    FROM jsonb_array_elements(placement_result.slots_created) time_slot;

    -- Update resource availability
    UPDATE _stage_tails 
    SET next_available_time = stage_end_time
    WHERE stage_id = r_stage.production_stage_id;

    -- CRITICAL FIX: Record this stage's completion time for dependent stages
    INSERT INTO _job_stage_ends (job_id, stage_instance_id, stage_order, scheduled_end_at)
    VALUES (r_stage.job_id, r_stage.stage_instance_id, r_stage.stage_order, stage_end_time);

    -- Update job stage instance
    UPDATE job_stage_instances
    SET 
      scheduled_minutes = r_stage.duration_minutes,
      scheduled_start_at = (
        SELECT MIN((time_slot ->> 'start_time')::timestamptz)
        FROM jsonb_array_elements(placement_result.slots_created) time_slot
      ),
      scheduled_end_at = stage_end_time,
      schedule_status = 'scheduled',
      updated_at = now()
    WHERE id = r_stage.stage_instance_id;
    updated_count := updated_count + 1;

    RAISE NOTICE 'RESOURCE-FILL Completed stage % - ends at %',
      r_stage.stage_name, stage_end_time;
  END LOOP;

  -- Validation
  SELECT jsonb_agg(
    jsonb_build_object(
      'job_id', v.job_id,
      'violation_type', v.violation_type,
      'stage1_name', v.stage1_name,
      'stage1_order', v.stage1_order,
      'stage2_name', v.stage2_name,
      'stage2_order', v.stage2_order,
      'violation_details', v.violation_details
    )
  ) INTO validation_results
  FROM public.validate_job_scheduling_precedence() v;

  IF validation_results IS NULL THEN
    validation_results := '[]'::jsonb;
  END IF;

  RAISE NOTICE 'RESOURCE-FILL Scheduler complete: wrote % slots, updated % stage instances, found % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  -- Return single record instead of using RETURN NEXT
  result_record.wrote_slots := wrote_count;
  result_record.updated_jsi := updated_count;
  result_record.violations := validation_results;
  
  RETURN result_record;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'RESOURCE-FILL Scheduler failed: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.scheduler_resource_fill_optimized() IS 'PRIMARY SCHEDULER (Oct 24 base) - Fixed to honor predecessor stage completion times. Stages within a job now wait for all earlier stage_order stages to complete before starting.';