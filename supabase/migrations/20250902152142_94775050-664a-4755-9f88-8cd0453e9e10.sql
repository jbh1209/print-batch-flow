-- Fix SQL scheduler variable conflicts and logic issues
-- This replaces the problematic scheduler functions with corrected versions

DROP FUNCTION IF EXISTS public.scheduler_reschedule_all(timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(uuid[], timestamp with time zone, boolean);

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
  RAISE NOTICE 'Cleared existing non-completed time slots';

  -- Initialize stage availability tracker (mirrors TypeScript avail Map)
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize all stages to base time
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') <> 'completed';

  RAISE NOTICE 'Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

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
    RAISE NOTICE 'Processing job % starting from %', r_job.job_id, job_earliest_start;
    
    -- Process stages by order (wave processing like TypeScript)
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
        -- Get resource availability (mirrors TypeScript avail.get())
        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        -- Calculate earliest start (mirrors TypeScript logic)
        stage_earliest_start := GREATEST(job_earliest_start, resource_available_time);

        RAISE NOTICE 'Scheduling stage % (% mins) from %', 
          r_stage.stage_instance_id, r_stage.duration_minutes, stage_earliest_start;

        -- Place the duration (mirrors TypeScript scheduleStageIntoWorkingDays)
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
        
        IF placement_result.placement_success THEN
          -- Validate slots_created is not empty
          IF jsonb_array_length(COALESCE(placement_result.slots_created, '[]'::jsonb)) = 0 THEN
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

          -- Update resource availability (mirrors TypeScript avail.set())
          UPDATE _stage_tails 
          SET next_available_time = (
            SELECT MAX((time_slot ->> 'end_time')::timestamptz)
            FROM jsonb_array_elements(placement_result.slots_created) time_slot
          )
          WHERE stage_id = r_stage.production_stage_id;

          -- Update job stage instance
          UPDATE job_stage_instances
          SET 
            scheduled_minutes = r_stage.duration_minutes,
            scheduled_start_at = (
              SELECT MIN((time_slot ->> 'start_time')::timestamptz)
              FROM jsonb_array_elements(placement_result.slots_created) time_slot
            ),
            scheduled_end_at = (
              SELECT MAX((time_slot ->> 'end_time')::timestamptz)
              FROM jsonb_array_elements(placement_result.slots_created) time_slot
            ),
            schedule_status = 'scheduled',
            updated_at = now()
          WHERE id = r_stage.stage_instance_id;
          updated_count := updated_count + 1;

          -- Update job barrier for next wave (fixed logic)
          SELECT MAX((time_slot ->> 'end_time')::timestamptz)
          INTO job_earliest_start
          FROM jsonb_array_elements(placement_result.slots_created) time_slot
          WHERE job_earliest_start < (time_slot ->> 'end_time')::timestamptz;

          RAISE NOTICE 'Scheduled stage % from % to %',
            r_stage.stage_instance_id,
            (SELECT MIN((time_slot ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) time_slot),
            (SELECT MAX((time_slot ->> 'end_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) time_slot);
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

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Scheduler failed: %', SQLERRM;
END;
$function$;

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

        -- Calculate earliest start
        stage_earliest_start := GREATEST(job_earliest_start, resource_available_time);

        RAISE NOTICE 'Appending stage % (% mins) from %', 
          r_stage.stage_instance_id, r_stage.duration_minutes, stage_earliest_start;

        -- Place the duration
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
        
        IF placement_result.placement_success THEN
          -- Validate slots_created is not empty
          IF jsonb_array_length(COALESCE(placement_result.slots_created, '[]'::jsonb)) = 0 THEN
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

          -- Update resource availability
          UPDATE _stage_tails 
          SET next_available_time = (
            SELECT MAX((time_slot ->> 'end_time')::timestamptz)
            FROM jsonb_array_elements(placement_result.slots_created) time_slot
          )
          WHERE stage_id = r_stage.production_stage_id;

          -- Update job stage instance
          UPDATE job_stage_instances
          SET 
            scheduled_minutes = r_stage.duration_minutes,
            scheduled_start_at = (
              SELECT MIN((time_slot ->> 'start_time')::timestamptz)
              FROM jsonb_array_elements(placement_result.slots_created) time_slot
            ),
            scheduled_end_at = (
              SELECT MAX((time_slot ->> 'end_time')::timestamptz)
              FROM jsonb_array_elements(placement_result.slots_created) time_slot
            ),
            schedule_status = 'scheduled',
            updated_at = now()
          WHERE id = r_stage.stage_instance_id;
          updated_count := updated_count + 1;

          -- Update job barrier for next wave (fixed logic)
          SELECT MAX((time_slot ->> 'end_time')::timestamptz)
          INTO job_earliest_start
          FROM jsonb_array_elements(placement_result.slots_created) time_slot
          WHERE job_earliest_start < (time_slot ->> 'end_time')::timestamptz;

          RAISE NOTICE 'Appended stage %', r_stage.stage_instance_id;
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

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Append scheduler failed: %', SQLERRM;
END;
$function$;