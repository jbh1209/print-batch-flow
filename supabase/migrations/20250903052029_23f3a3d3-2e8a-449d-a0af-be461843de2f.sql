-- Update scheduler_reschedule_all to include post-scheduling validation
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  
  -- Job processing variables
  r_job record;
  r_stage_order record;
  r_stage record;
  
  -- Scheduling variables
  resource_available_time timestamptz;
  job_earliest_start timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 42);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting scheduler from: %', base_time;

  -- Clear existing non-completed slots
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  RAISE NOTICE 'Cleared existing non-completed time slots';

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize all stages to base time
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') <> 'completed';

  RAISE NOTICE 'Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- Create scheduling queue
  CREATE TEMPORARY TABLE _scheduling_queue AS
  SELECT
    jsi.id as stage_instance_id,
    jsi.job_id,
    jsi.production_stage_id,
    COALESCE(jsi.stage_order, 999999) as stage_order,
    public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
    pj.proof_approved_at
  FROM job_stage_instances jsi
  JOIN production_jobs pj ON pj.id = jsi.job_id
  WHERE COALESCE(jsi.status, '') <> 'completed'
  ORDER BY pj.proof_approved_at ASC, jsi.job_id, jsi.stage_order;

  RAISE NOTICE 'Found % items to schedule', (SELECT COUNT(*) FROM _scheduling_queue);

  -- Process jobs in FIFO order
  FOR r_job IN
    SELECT DISTINCT job_id, proof_approved_at 
    FROM _scheduling_queue
    ORDER BY proof_approved_at ASC, job_id
  LOOP
    job_earliest_start := GREATEST(base_time, r_job.proof_approved_at);
    RAISE NOTICE 'Processing job % starting from %', r_job.job_id, job_earliest_start;
    
    -- Process stages by order (wave processing)
    FOR r_stage_order IN
      SELECT DISTINCT stage_order 
      FROM _scheduling_queue 
      WHERE job_id = r_job.job_id
      ORDER BY stage_order
    LOOP
      RAISE NOTICE 'Processing wave % for job %', r_stage_order.stage_order, r_job.job_id;
      
      -- Process all stages in this wave
      FOR r_stage IN
        SELECT * FROM _scheduling_queue
        WHERE job_id = r_job.job_id AND stage_order = r_stage_order.stage_order
        ORDER BY stage_instance_id
      LOOP
        -- Get resource availability
        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        -- Defensive check
        IF resource_available_time IS NULL THEN
          RAISE WARNING 'No resource availability found for stage %, initializing to base_time', r_stage.production_stage_id;
          resource_available_time := base_time;
        END IF;

        -- Calculate earliest start
        stage_earliest_start := GREATEST(job_earliest_start, resource_available_time);

        RAISE NOTICE 'Scheduling stage % (% mins) from %', 
          r_stage.stage_instance_id, r_stage.duration_minutes, stage_earliest_start;

        -- Defensive check for duration
        IF r_stage.duration_minutes IS NULL OR r_stage.duration_minutes <= 0 THEN
          RAISE WARNING 'Invalid duration for stage %, setting to 60 minutes', r_stage.stage_instance_id;
          r_stage.duration_minutes := 60;
        END IF;

        -- Place the duration
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
        
        IF placement_result.placement_success AND placement_result.slots_created IS NOT NULL THEN
          -- Validate slots_created is not empty
          IF jsonb_array_length(placement_result.slots_created) = 0 THEN
            RAISE WARNING 'No slots created for stage % (% minutes)', 
              r_stage.stage_instance_id, r_stage.duration_minutes;
            CONTINUE;
          END IF;

          -- Create time slots from placement result
          FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
          LOOP
            -- Add NULL checks for JSONB extractions
            IF (slot_record ->> 'start_time') IS NULL OR (slot_record ->> 'end_time') IS NULL THEN
              RAISE WARNING 'Invalid slot data for stage %: %', r_stage.stage_instance_id, slot_record;
              CONTINUE;
            END IF;

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

          -- Update job stage instance with data integrity checks
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

          -- FIXED: Update job barrier for next wave - simple assignment of max end time
          IF stage_end_time > job_earliest_start THEN
            job_earliest_start := stage_end_time;
          END IF;

          RAISE NOTICE 'Scheduled stage % from % to %, job barrier now at %',
            r_stage.stage_instance_id,
            (SELECT MIN((time_slot ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) time_slot),
            stage_end_time,
            job_earliest_start;
        ELSE
          RAISE WARNING 'Failed to schedule stage instance % (% minutes) - placement failed: success=%, slots=%',
            r_stage.stage_instance_id, r_stage.duration_minutes, 
            COALESCE(placement_result.placement_success, false),
            COALESCE(jsonb_array_length(placement_result.slots_created), 0);
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- POST-SCHEDULING VALIDATION: Check for precedence violations
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

  RAISE NOTICE 'Scheduler complete: wrote % slots, updated % stage instances, found % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Scheduler failed: %', SQLERRM;
END;
$function$;