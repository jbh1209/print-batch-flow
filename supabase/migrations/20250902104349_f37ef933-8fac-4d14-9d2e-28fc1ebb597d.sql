-- Simplified snap_into_shift function without lunch break logic
CREATE OR REPLACE FUNCTION public.snap_into_shift(p_from timestamp with time zone, p_minutes integer)
 RETURNS TABLE(start_ts timestamp with time zone, end_ts timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  ts timestamptz := public.next_working_start(p_from);
  s timestamptz;
  e timestamptz;
  available_minutes int;
BEGIN
  LOOP
    -- Get shift window for this day
    SELECT win_start, win_end INTO s, e FROM public.shift_window(ts::date);

    -- Skip if no shift or non-working day
    IF s IS NULL OR NOT public.is_working_day(ts::date) THEN
      ts := public.next_working_start(ts + interval '1 day');
      CONTINUE;
    END IF;

    -- Ensure we start no earlier than the shift start
    IF ts < s THEN
      ts := s;
    END IF;

    -- Calculate available minutes from current time to end of shift
    available_minutes := EXTRACT(epoch FROM (e - ts)) / 60;

    -- If task fits in remaining shift time, schedule it
    IF p_minutes <= available_minutes THEN
      start_ts := ts;
      end_ts := ts + make_interval(mins => p_minutes);
      RETURN;
    END IF;

    -- Task doesn't fit, move to next working day
    ts := public.next_working_start(e + interval '1 minute');
  END LOOP;
END;
$function$;

-- Update scheduler functions to include better error handling and logging
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  base timestamptz;
  wrote int := 0;
  upjsi int := 0;
  
  -- job & ordering
  r_job record;
  r_ord record;
  r record;
  
  latest_end timestamptz;
  barrier timestamptz;
  r_tail timestamptz;
  s timestamptz;
  e timestamptz;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 42);

  -- Start from next working day if not provided
  IF p_start_from IS NULL THEN
    base := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base := public.next_working_start(p_start_from);
  END IF;

  -- Log the base time
  RAISE NOTICE 'Starting reschedule from: %', base;

  -- Clear all non-completed time slots
  DELETE FROM stage_time_slots
  WHERE COALESCE(is_completed, false) = false;

  -- Initialize stage tails at base time
  CREATE TEMPORARY TABLE _tails(stage_id uuid PRIMARY KEY, tail timestamptz) ON COMMIT DROP;
  INSERT INTO _tails(stage_id, tail)
  SELECT ps.id, base
  FROM (SELECT DISTINCT production_stage_id as id
        FROM job_stage_instances
        WHERE COALESCE(status,'') <> 'completed') ps;

  -- Gather items to schedule
  CREATE TEMPORARY TABLE _items AS
  SELECT
    jsi.id as stage_instance_id,
    jsi.production_stage_id,
    jsi.job_id,
    COALESCE(jsi.stage_order, 999999) as stage_order,
    public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as minutes
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status,'') <> 'completed';

  RAISE NOTICE 'Found % items to schedule', (SELECT COUNT(*) FROM _items);

  -- Schedule by job, then by stage order (wave processing)
  FOR r_job IN
    SELECT job_id FROM _items GROUP BY job_id
    ORDER BY job_id
  LOOP
    barrier := base;

    FOR r_ord IN
      SELECT DISTINCT stage_order FROM _items
      WHERE job_id = r_job.job_id
      ORDER BY stage_order
    LOOP
      latest_end := NULL;

      FOR r IN
        SELECT * FROM _items
        WHERE job_id = r_job.job_id AND stage_order = r_ord.stage_order
        ORDER BY stage_instance_id
      LOOP
        -- Get current stage tail
        SELECT t.tail INTO r_tail
        FROM _tails t
        WHERE t.stage_id = r.production_stage_id
        FOR UPDATE;

        IF r_tail IS NULL THEN
          r_tail := base;
          INSERT INTO _tails(stage_id, tail)
          VALUES (r.production_stage_id, base)
          ON CONFLICT (stage_id) DO NOTHING;
        END IF;

        -- Schedule at max(stage_tail, barrier) and snap to working hours
        SELECT start_ts, end_ts
        INTO s, e
        FROM public.snap_into_shift(greatest(r_tail, barrier), r.minutes);

        -- Validate that we got valid timestamps
        IF s IS NULL OR e IS NULL THEN
          RAISE EXCEPTION 'Failed to schedule stage instance %. Got NULL timestamps from snap_into_shift for % minutes starting from %', 
            r.stage_instance_id, r.minutes, greatest(r_tail, barrier);
        END IF;

        RAISE NOTICE 'Scheduling stage % from % to % (% minutes)', 
          r.stage_instance_id, s, e, r.minutes;

        -- Insert time slot
        INSERT INTO stage_time_slots(
          production_stage_id, slot_start_time, slot_end_time,
          duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
        )
        VALUES (
          r.production_stage_id,
          s, e,
          r.minutes,
          r.job_id,
          'production_jobs',
          r.stage_instance_id,
          false
        );
        wrote := wrote + 1;

        -- Update stage tail
        UPDATE _tails SET tail = e WHERE stage_id = r.production_stage_id;

        -- Update job stage instance
        UPDATE job_stage_instances j
        SET scheduled_minutes = r.minutes,
            scheduled_start_at = s,
            scheduled_end_at = e,
            schedule_status = 'scheduled',
            updated_at = now()
        WHERE j.id = r.stage_instance_id;
        upjsi := upjsi + 1;

        -- Update barrier for this wave
        IF e > barrier THEN
          barrier := e;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Reschedule complete: wrote % slots, updated % stage instances', wrote, upjsi;

  wrote_slots := wrote;
  updated_jsi := upjsi;
  RETURN NEXT;
END;
$function$;

-- Update the append jobs function with the same error handling
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(p_job_ids uuid[], p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_only_if_unset boolean DEFAULT true)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  base timestamptz := public.next_working_start(COALESCE(p_start_from, now() AT TIME ZONE 'utc'));
  wrote int := 0;
  upjsi int := 0;
  
  r_job record;
  r_ord record;
  r record;
  
  r_tail timestamptz;
  candidate_start timestamptz;
  s timestamptz;
  e timestamptz;
  
  barrier timestamptz;
  max_existing_prior_orders timestamptz;
  max_existing_this_order timestamptz;
BEGIN
  IF p_job_ids IS NULL OR array_length(p_job_ids,1) IS NULL THEN
    RAISE EXCEPTION 'scheduler_append_jobs: p_job_ids must not be empty';
  END IF;

  PERFORM pg_advisory_xact_lock(1, 42);

  RAISE NOTICE 'Appending % jobs starting from %', array_length(p_job_ids,1), base;

  -- Initialize stage tails from existing slots
  CREATE TEMPORARY TABLE _tails(stage_id uuid PRIMARY KEY, tail timestamptz) ON COMMIT DROP;
  INSERT INTO _tails(stage_id, tail)
  SELECT production_stage_id, greatest(max(slot_end_time), base)
  FROM stage_time_slots
  GROUP BY production_stage_id;

  -- Ensure every stage has a tail entry
  INSERT INTO _tails(stage_id, tail)
  SELECT DISTINCT jsi.production_stage_id, base
  FROM job_stage_instances jsi
  WHERE jsi.job_id = ANY(p_job_ids)
  ON CONFLICT (stage_id) DO NOTHING;

  -- Items to schedule
  CREATE TEMPORARY TABLE _items AS
  SELECT
    jsi.id as stage_instance_id,
    jsi.production_stage_id,
    jsi.job_id,
    COALESCE(jsi.stage_order, 999999) as stage_order,
    public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as minutes,
    jsi.scheduled_start_at,
    jsi.scheduled_end_at
  FROM job_stage_instances jsi
  WHERE jsi.job_id = ANY(p_job_ids)
    AND COALESCE(jsi.status,'') <> 'completed'
    AND (NOT p_only_if_unset OR (jsi.scheduled_start_at IS NULL AND jsi.scheduled_end_at IS NULL));

  RAISE NOTICE 'Found % items to append', (SELECT COUNT(*) FROM _items);

  -- Schedule per job respecting existing waves
  FOR r_job IN
    SELECT job_id FROM _items GROUP BY job_id
  LOOP
    barrier := base;

    FOR r_ord IN
      SELECT DISTINCT stage_order FROM (
        SELECT DISTINCT stage_order FROM _items WHERE job_id = r_job.job_id
        UNION
        SELECT DISTINCT COALESCE(stage_order,999999)
        FROM job_stage_instances
        WHERE job_id = r_job.job_id
      ) q
      ORDER BY stage_order
    LOOP
      -- Respect prior waves
      SELECT max(scheduled_end_at)
      INTO max_existing_prior_orders
      FROM job_stage_instances
      WHERE job_id = r_job.job_id
        AND COALESCE(stage_order,999999) < r_ord.stage_order
        AND scheduled_end_at IS NOT NULL;

      IF max_existing_prior_orders IS NOT NULL AND max_existing_prior_orders > barrier THEN
        barrier := max_existing_prior_orders;
      END IF;

      -- Schedule items for this order
      FOR r IN
        SELECT * FROM _items
        WHERE job_id = r_job.job_id AND stage_order = r_ord.stage_order
        ORDER BY stage_instance_id
      LOOP
        SELECT tail INTO r_tail FROM _tails WHERE stage_id = r.production_stage_id FOR UPDATE;
        candidate_start := greatest(COALESCE(r_tail, base), barrier);

        SELECT start_ts, end_ts INTO s, e
        FROM public.snap_into_shift(candidate_start, r.minutes);

        -- Validate timestamps
        IF s IS NULL OR e IS NULL THEN
          RAISE EXCEPTION 'Failed to schedule stage instance %. Got NULL timestamps from snap_into_shift for % minutes starting from %', 
            r.stage_instance_id, r.minutes, candidate_start;
        END IF;

        RAISE NOTICE 'Appending stage % from % to % (% minutes)', 
          r.stage_instance_id, s, e, r.minutes;

        -- Insert time slot
        INSERT INTO stage_time_slots(
          production_stage_id, slot_start_time, slot_end_time,
          duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
        )
        VALUES (
          r.production_stage_id,
          s, e,
          r.minutes,
          r.job_id,
          'production_jobs',
          r.stage_instance_id,
          false
        );
        wrote := wrote + 1;

        UPDATE _tails SET tail = e WHERE stage_id = r.production_stage_id;

        UPDATE job_stage_instances j
        SET scheduled_minutes = r.minutes,
            scheduled_start_at = s,
            scheduled_end_at = e,
            schedule_status = 'scheduled',
            updated_at = now()
        WHERE j.id = r.stage_instance_id;
        upjsi := upjsi + 1;

        IF e > barrier THEN barrier := e; END IF;
      END LOOP;

      -- Respect current wave's existing items
      SELECT max(scheduled_end_at)
      INTO max_existing_this_order
      FROM job_stage_instances
      WHERE job_id = r_job.job_id
        AND COALESCE(stage_order,999999) = r_ord.stage_order
        AND scheduled_end_at IS NOT NULL;

      IF max_existing_this_order IS NOT NULL AND max_existing_this_order > barrier THEN
        barrier := max_existing_this_order;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Append complete: wrote % slots, updated % stage instances', wrote, upjsi;

  wrote_slots := wrote;
  updated_jsi := upjsi;
  RETURN NEXT;
END;
$function$;