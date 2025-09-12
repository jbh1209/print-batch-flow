-- Fix scheduler time-awareness for 3 AM cron jobs
-- When cron runs before shift start (8 AM), schedule for same day
-- When cron runs after shift start, schedule for next working day

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

  -- Initialize any stages not yet tracked
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
  ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE 'RESOURCE-FILL Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- Process stages by resource availability (RESOURCE-FILL strategy)
  -- CRITICAL FIX: Only schedule proof-approved jobs
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
        AND pj.proof_approved_at IS NOT NULL  -- CRITICAL FIX: Only approved jobs
      ORDER BY 
        st.next_available_time ASC,  -- Fill resources by availability first
        pj.proof_approved_at ASC,    -- Then by job approval order
        jsi.stage_order ASC,         -- Then by stage sequence
        jsi.id ASC                   -- Finally by creation order
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