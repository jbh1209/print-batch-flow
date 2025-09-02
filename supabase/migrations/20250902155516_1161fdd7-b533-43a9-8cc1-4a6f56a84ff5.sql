-- Fix critical SQL scheduler logic issues
-- This migration addresses job barrier update logic, adds defensive programming, 
-- and improves multi-day placement efficiency

-- 1. Fix the scheduler_reschedule_all function
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  
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

  RAISE NOTICE 'Scheduler complete: wrote % slots, updated % stage instances', wrote_count, updated_count;

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Scheduler failed: %', SQLERRM;
END;
$function$;

-- 2. Fix the scheduler_append_jobs function
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(p_job_ids uuid[], p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_only_if_unset boolean DEFAULT true)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  base_time timestamptz := public.next_working_start(COALESCE(p_start_from, now() AT TIME ZONE 'utc'));
  wrote_count integer := 0;
  updated_count integer := 0;
  
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
  existing_barrier timestamptz;
  stage_end_time timestamptz;
BEGIN
  -- Validation
  IF p_job_ids IS NULL OR array_length(p_job_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'scheduler_append_jobs: p_job_ids must not be empty';
  END IF;

  -- Advisory lock
  PERFORM pg_advisory_xact_lock(1, 42);

  RAISE NOTICE 'Appending % jobs starting from %', array_length(p_job_ids, 1), base_time;

  -- Initialize stage availability tracker from existing slots
  PERFORM public.create_stage_availability_tracker();
  
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    GREATEST(MAX(slot_end_time), base_time)
  FROM stage_time_slots
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- Ensure all relevant stages have entries
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE jsi.job_id = ANY(p_job_ids)
  ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE 'Initialized % production stages for appending', (SELECT COUNT(*) FROM _stage_tails);

  -- Create items to append
  CREATE TEMPORARY TABLE _append_queue AS
  SELECT
    jsi.id as stage_instance_id,
    jsi.job_id,
    jsi.production_stage_id,
    COALESCE(jsi.stage_order, 999999) as stage_order,
    public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
    pj.proof_approved_at
  FROM job_stage_instances jsi
  JOIN production_jobs pj ON pj.id = jsi.job_id
  WHERE jsi.job_id = ANY(p_job_ids)
    AND COALESCE(jsi.status, '') <> 'completed'
    AND (NOT p_only_if_unset OR (jsi.scheduled_start_at IS NULL AND jsi.scheduled_end_at IS NULL))
  ORDER BY pj.proof_approved_at ASC, jsi.job_id, jsi.stage_order;

  RAISE NOTICE 'Found % items to append', (SELECT COUNT(*) FROM _append_queue);

  -- Process jobs maintaining existing schedule integrity
  FOR r_job IN
    SELECT DISTINCT job_id, proof_approved_at 
    FROM _append_queue
    ORDER BY proof_approved_at ASC, job_id
  LOOP
    -- Find existing job barrier (respect existing scheduled items)
    SELECT COALESCE(MAX(scheduled_end_at), base_time)
    INTO existing_barrier
    FROM job_stage_instances
    WHERE job_id = r_job.job_id AND scheduled_end_at IS NOT NULL;
    
    job_earliest_start := GREATEST(base_time, r_job.proof_approved_at, existing_barrier);
    RAISE NOTICE 'Processing job % with barrier at %', r_job.job_id, job_earliest_start;
    
    -- Process stages by order (wave processing)
    FOR r_stage_order IN
      SELECT DISTINCT stage_order 
      FROM _append_queue 
      WHERE job_id = r_job.job_id
      ORDER BY stage_order
    LOOP
      -- Respect existing waves
      SELECT COALESCE(MAX(scheduled_end_at), job_earliest_start)
      INTO job_earliest_start
      FROM job_stage_instances
      WHERE job_id = r_job.job_id 
        AND COALESCE(stage_order, 999999) < r_stage_order.stage_order
        AND scheduled_end_at IS NOT NULL;

      -- Process all stages in this wave
      FOR r_stage IN
        SELECT * FROM _append_queue
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

        RAISE NOTICE 'Appending stage % (% mins) from %', 
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

          -- Create time slots
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

          -- FIXED: Update job barrier for next wave - simple assignment of max end time
          IF stage_end_time > job_earliest_start THEN
            job_earliest_start := stage_end_time;
          END IF;

          RAISE NOTICE 'Appended stage % from % to %, job barrier now at %', 
            r_stage.stage_instance_id,
            (SELECT MIN((time_slot ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) time_slot),
            stage_end_time,
            job_earliest_start;
        ELSE
          RAISE WARNING 'Failed to append stage instance % (% minutes) - placement failed: success=%, slots=%',
            r_stage.stage_instance_id, r_stage.duration_minutes,
            COALESCE(placement_result.placement_success, false),
            COALESCE(jsonb_array_length(placement_result.slots_created), 0);
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Append complete: wrote % slots, updated % stage instances', wrote_count, updated_count;

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Append scheduler failed: %', SQLERRM;
END;
$function$;

-- 3. Improve the place_duration_sql function for better multi-day efficiency
CREATE OR REPLACE FUNCTION public.place_duration_sql(p_earliest_start timestamp with time zone, p_duration_minutes integer, p_max_days integer DEFAULT 30)
 RETURNS TABLE(placement_success boolean, slots_created jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  current_day date;
  day_start timestamptz;
  day_end timestamptz;
  available_start timestamptz;
  remaining_minutes integer := p_duration_minutes;
  slots jsonb := '[]'::jsonb;
  day_count integer := 0;
  slot_start timestamptz;
  slot_end timestamptz;
  slot_duration integer;
  day_remaining_capacity integer;
BEGIN
  -- Validate inputs
  IF p_duration_minutes <= 0 THEN
    RETURN QUERY SELECT false, '[]'::jsonb;
    RETURN;
  END IF;

  -- Start from the earliest possible working moment
  available_start := public.next_working_start(p_earliest_start);
  current_day := available_start::date;

  WHILE remaining_minutes > 0 AND day_count < p_max_days LOOP
    day_count := day_count + 1;
    
    -- Skip non-working days
    IF NOT public.is_working_day(current_day) THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz + time '08:00');
      CONTINUE;
    END IF;

    -- Get shift window for this day
    SELECT win_start, win_end INTO day_start, day_end 
    FROM public.shift_window(current_day);
    
    IF day_start IS NULL OR day_end IS NULL THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz + time '08:00');
      CONTINUE;
    END IF;

    -- Ensure we start no earlier than shift start and no earlier than available_start
    slot_start := GREATEST(available_start, day_start);
    
    -- Calculate remaining capacity for this day
    day_remaining_capacity := GREATEST(0, EXTRACT(epoch FROM (day_end - slot_start)) / 60)::integer;
    
    -- Skip if no capacity left in this day
    IF day_remaining_capacity <= 0 THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz + time '08:00');
      CONTINUE;
    END IF;
    
    -- Calculate how much we can fit in this day
    slot_duration := LEAST(remaining_minutes, day_remaining_capacity);
    slot_end := slot_start + make_interval(mins => slot_duration);
    
    -- Add slot to our result
    slots := slots || jsonb_build_object(
      'start_time', slot_start,
      'end_time', slot_end,
      'duration_minutes', slot_duration,
      'date', current_day
    );
    
    remaining_minutes := remaining_minutes - slot_duration;
    
    -- If we still have remaining minutes, move to next day
    IF remaining_minutes > 0 THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz + time '08:00');
    END IF;
  END LOOP;

  -- Return success if we placed all minutes within the day limit
  RETURN QUERY SELECT (remaining_minutes = 0), slots;
END;
$function$;