-- ============================================
-- Enhanced Database-Centric Scheduler System
-- Replaces TypeScript Edge Function with pure SQL
-- ============================================

-- Helper: Check if a date is a working day
CREATE OR REPLACE FUNCTION public.is_working_day(p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(ss.is_working_day, false)
         AND NOT EXISTS (
           SELECT 1 FROM public_holidays ph
           WHERE ph.date = p_date AND ph.is_active = true
         )
  FROM shift_schedules ss
  WHERE ss.day_of_week = EXTRACT(dow FROM p_date)::int
  LIMIT 1;
$$;

-- Helper: Get shift window for a date (enhanced with lunch break logic)
CREATE OR REPLACE FUNCTION public.shift_window(p_date date)
RETURNS TABLE(win_start timestamptz, win_end timestamptz)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (p_date::timestamptz + ss.shift_start_time) as win_start,
    (p_date::timestamptz + ss.shift_end_time) as win_end
  FROM shift_schedules ss
  WHERE ss.day_of_week = EXTRACT(dow FROM p_date)::int
    AND COALESCE(ss.is_active, true) = true
  LIMIT 1;
$$;

-- Helper: Find next working start time from a given timestamp
CREATE OR REPLACE FUNCTION public.next_working_start(p_from timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  ts timestamptz := date_trunc('minute', p_from);
  wd date;
  s timestamptz;
  e timestamptz;
  guard int := 0;
BEGIN
  LOOP
    guard := guard + 1;
    IF guard > 365 THEN
      RAISE EXCEPTION 'next_working_start guard tripped for %', p_from;
    END IF;

    wd := ts::date;
    SELECT win_start, win_end INTO s, e FROM public.shift_window(wd);

    IF s IS NOT NULL AND public.is_working_day(wd) THEN
      IF ts < s THEN
        RETURN s; -- before shift -> start at shift open
      ELSIF ts >= s AND ts < e THEN
        RETURN ts; -- inside shift -> ok
      END IF;
    END IF;

    -- push to next day 08:00 by leveraging next day shift start
    ts := (wd + 1)::timestamptz + time '08:00';
  END LOOP;
END;
$$;

-- Helper: Snap a task into a shift window (with lunch break logic)
CREATE OR REPLACE FUNCTION public.snap_into_shift(p_from timestamptz, p_minutes int)
RETURNS TABLE(start_ts timestamptz, end_ts timestamptz)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  ts timestamptz := public.next_working_start(p_from);
  s timestamptz;
  e timestamptz;
  lunch_start timestamptz;
  lunch_end timestamptz;
  morning_end timestamptz;
  afternoon_start timestamptz;
  morning_available int;
  afternoon_available int;
BEGIN
  LOOP
    SELECT win_start, win_end INTO s, e FROM public.shift_window(ts::date);

    IF s IS NULL OR NOT public.is_working_day(ts::date) THEN
      ts := public.next_working_start(ts + interval '1 day');
      CONTINUE;
    END IF;

    IF ts < s THEN
      ts := s;
    END IF;

    -- Define lunch break (13:00-13:30)
    lunch_start := date_trunc('day', ts) + time '13:00';
    lunch_end := date_trunc('day', ts) + time '13:30';
    morning_end := lunch_start;
    afternoon_start := lunch_end;

    -- Check if task fits in morning slot (8:00-13:00)
    IF ts < lunch_start THEN
      morning_available := EXTRACT(epoch FROM (morning_end - ts)) / 60;
      IF p_minutes <= morning_available THEN
        start_ts := ts;
        end_ts := ts + make_interval(mins => p_minutes);
        RETURN;
      END IF;
    END IF;

    -- Check if task fits in afternoon slot (13:30-16:30)
    IF ts < afternoon_start THEN
      ts := afternoon_start; -- move to afternoon start
    END IF;
    
    afternoon_available := EXTRACT(epoch FROM (e - ts)) / 60;
    IF p_minutes <= afternoon_available THEN
      start_ts := ts;
      end_ts := ts + make_interval(mins => p_minutes);
      RETURN;
    END IF;

    -- doesn't fit -> use next working day's shift start
    ts := public.next_working_start(e + interval '1 minute');
  END LOOP;
END;
$$;

-- Helper: Get duration minutes for a job stage instance (minimum 1)
CREATE OR REPLACE FUNCTION public.jsi_minutes(p_scheduled int, p_estimated int)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT greatest(1, COALESCE(p_scheduled, p_estimated, 1));
$$;

-- Main function: Reschedule all pending stages (nightly operation)
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all(p_start_from timestamptz DEFAULT NULL)
RETURNS TABLE(wrote_slots int, updated_jsi int)
LANGUAGE plpgsql
AS $$
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

        -- Insert time slot
        INSERT INTO stage_time_slots(
          production_stage_id, date, slot_start_time, slot_end_time,
          duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
        )
        VALUES (
          r.production_stage_id,
          s::date,
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

  wrote_slots := wrote;
  updated_jsi := upjsi;
  RETURN NEXT;
END;
$$;

-- Incremental function: Append specific jobs to existing schedule
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[],
  p_start_from timestamptz DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(wrote_slots int, updated_jsi int)
LANGUAGE plpgsql
AS $$
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

        INSERT INTO stage_time_slots(
          production_stage_id, date, slot_start_time, slot_end_time,
          duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
        )
        VALUES (
          r.production_stage_id,
          s::date,
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

  wrote_slots := wrote;
  updated_jsi := upjsi;
  RETURN NEXT;
END;
$$;

-- Wrapper function for simple scheduler calls
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all')
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result record;
  response jsonb;
BEGIN
  CASE p_mode
    WHEN 'reschedule_all' THEN
      SELECT * INTO result FROM public.scheduler_reschedule_all();
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'mode', 'reschedule_all'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  
  RETURN response;
END;
$$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_jsi_job_status ON job_stage_instances(job_id, status);
CREATE INDEX IF NOT EXISTS idx_jsi_job_order ON job_stage_instances(job_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_slots_stage_end ON stage_time_slots(production_stage_id, slot_end_time);
CREATE INDEX IF NOT EXISTS idx_jsi_production_stage ON job_stage_instances(production_stage_id);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_dow ON shift_schedules(day_of_week) WHERE is_active = true;