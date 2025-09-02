-- Redesign SQL Scheduler Following Proven TypeScript Patterns
-- This migration replaces the problematic scheduler functions with ones that mirror
-- the proven TypeScript logic for resource availability, dependency processing, and multi-day placement

-- Replace the problematic snap_into_shift function with a robust multi-day placement function
DROP FUNCTION IF EXISTS public.snap_into_shift(timestamp with time zone, integer);

CREATE OR REPLACE FUNCTION public.place_duration_sql(
  p_earliest_start timestamptz,
  p_duration_minutes integer,
  p_max_days integer DEFAULT 30
)
RETURNS TABLE(
  placement_success boolean,
  slots_created jsonb
) 
LANGUAGE plpgsql
STABLE
AS $$
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
    
    -- Calculate how much we can fit in this day
    slot_duration := LEAST(
      remaining_minutes,
      EXTRACT(epoch FROM (day_end - slot_start)) / 60
    )::integer;
    
    -- Only create slot if we have meaningful duration
    IF slot_duration > 0 THEN
      slot_end := slot_start + make_interval(mins => slot_duration);
      
      -- Add slot to our result
      slots := slots || jsonb_build_object(
        'start_time', slot_start,
        'end_time', slot_end,
        'duration_minutes', slot_duration,
        'date', current_day
      );
      
      remaining_minutes := remaining_minutes - slot_duration;
    END IF;
    
    -- Move to next day
    current_day := current_day + 1;
    available_start := public.next_working_start(current_day::timestamptz + time '08:00');
  END LOOP;

  -- Return success if we placed all minutes within the day limit
  RETURN QUERY SELECT (remaining_minutes = 0), slots;
END;
$$;

-- Create a function to track and update resource availability (like TypeScript avail Map)
CREATE OR REPLACE FUNCTION public.create_stage_availability_tracker()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create temporary table for tracking stage availability (like TypeScript avail Map)
  CREATE TEMPORARY TABLE IF NOT EXISTS _stage_tails(
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  ) ON COMMIT DROP;
END;
$$;

-- Redesigned scheduler_reschedule_all following TypeScript patterns
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer)
LANGUAGE plpgsql
AS $$
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
  slot_info jsonb;
  slot record;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 42);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting redesigned scheduler from: %', base_time;

  -- Clear existing non-completed slots
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;

  -- Initialize stage availability tracker (mirrors TypeScript avail Map)
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize all stages to base time
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') <> 'completed';

  -- Create items table for FIFO processing (mirrors TypeScript pendingStages)
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

  -- Process jobs in FIFO order (mirrors TypeScript processStagesSequentially)
  FOR r_job IN
    SELECT DISTINCT job_id, proof_approved_at 
    FROM _scheduling_queue
    ORDER BY proof_approved_at ASC, job_id
  LOOP
    job_earliest_start := GREATEST(base_time, r_job.proof_approved_at);
    
    -- Process stages by order (wave processing like TypeScript)
    FOR r_stage_order IN
      SELECT DISTINCT stage_order 
      FROM _scheduling_queue 
      WHERE job_id = r_job.job_id
      ORDER BY stage_order
    LOOP
      -- Process all stages in this wave
      FOR r_stage IN
        SELECT * FROM _scheduling_queue
        WHERE job_id = r_job.job_id AND stage_order = r_stage_order.stage_order
        ORDER BY stage_instance_id
      LOOP
        -- Get resource availability (mirrors TypeScript avail.get())
        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        -- Calculate earliest start (mirrors TypeScript logic)
        stage_earliest_start := GREATEST(job_earliest_start, resource_available_time);

        -- Place the duration (mirrors TypeScript scheduleStageIntoWorkingDays)
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
        
        IF placement_result.placement_success THEN
          -- Create time slots from placement result
          FOR slot_info IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
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

          -- Update resource availability (mirrors TypeScript avail.set())
          UPDATE _stage_tails 
          SET next_available_time = (
            SELECT MAX((slot_info ->> 'end_time')::timestamptz)
            FROM jsonb_array_elements(placement_result.slots_created) slot_info
          )
          WHERE stage_id = r_stage.production_stage_id;

          -- Update job stage instance
          UPDATE job_stage_instances
          SET 
            scheduled_minutes = r_stage.duration_minutes,
            scheduled_start_at = (
              SELECT MIN((slot_info ->> 'start_time')::timestamptz)
              FROM jsonb_array_elements(placement_result.slots_created) slot_info
            ),
            scheduled_end_at = (
              SELECT MAX((slot_info ->> 'end_time')::timestamptz)
              FROM jsonb_array_elements(placement_result.slots_created) slot_info
            ),
            schedule_status = 'scheduled',
            updated_at = now()
          WHERE id = r_stage.stage_instance_id;
          updated_count := updated_count + 1;

          -- Update job earliest start for next wave
          SELECT MAX((slot_info ->> 'end_time')::timestamptz)
          INTO job_earliest_start
          FROM jsonb_array_elements(placement_result.slots_created) slot_info
          WHERE job_earliest_start < (slot_info ->> 'end_time')::timestamptz;

          RAISE NOTICE 'Scheduled stage % (% minutes) from % to %',
            r_stage.stage_instance_id,
            r_stage.duration_minutes,
            (SELECT MIN((slot_info ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) slot_info),
            (SELECT MAX((slot_info ->> 'end_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) slot_info);
        ELSE
          RAISE WARNING 'Failed to schedule stage instance % (% minutes) - insufficient capacity',
            r_stage.stage_instance_id, r_stage.duration_minutes;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Redesigned scheduler complete: wrote % slots, updated % stage instances', wrote_count, updated_count;

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  RETURN NEXT;
END;
$$;

-- Redesigned scheduler_append_jobs following TypeScript patterns
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[],
  p_start_from timestamptz DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer)
LANGUAGE plpgsql
AS $$
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
  slot_info jsonb;
  existing_barrier timestamptz;
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

  -- Create items to append (mirrors TypeScript filtering)
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

        -- Calculate earliest start
        stage_earliest_start := GREATEST(job_earliest_start, resource_available_time);

        -- Place the duration
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
        
        IF placement_result.placement_success THEN
          -- Create time slots
          FOR slot_info IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
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

          -- Update resource availability
          UPDATE _stage_tails 
          SET next_available_time = (
            SELECT MAX((slot_info ->> 'end_time')::timestamptz)
            FROM jsonb_array_elements(placement_result.slots_created) slot_info
          )
          WHERE stage_id = r_stage.production_stage_id;

          -- Update job stage instance
          UPDATE job_stage_instances
          SET 
            scheduled_minutes = r_stage.duration_minutes,
            scheduled_start_at = (
              SELECT MIN((slot_info ->> 'start_time')::timestamptz)
              FROM jsonb_array_elements(placement_result.slots_created) slot_info
            ),
            scheduled_end_at = (
              SELECT MAX((slot_info ->> 'end_time')::timestamptz)
              FROM jsonb_array_elements(placement_result.slots_created) slot_info
            ),
            schedule_status = 'scheduled',
            updated_at = now()
          WHERE id = r_stage.stage_instance_id;
          updated_count := updated_count + 1;

          -- Update job barrier for next wave
          SELECT MAX((slot_info ->> 'end_time')::timestamptz)
          INTO job_earliest_start
          FROM jsonb_array_elements(placement_result.slots_created) slot_info
          WHERE job_earliest_start < (slot_info ->> 'end_time')::timestamptz;

          RAISE NOTICE 'Appended stage % (% minutes)', r_stage.stage_instance_id, r_stage.duration_minutes;
        ELSE
          RAISE WARNING 'Failed to append stage instance %', r_stage.stage_instance_id;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Append complete: wrote % slots, updated % stage instances', wrote_count, updated_count;

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  RETURN NEXT;
END;
$$;