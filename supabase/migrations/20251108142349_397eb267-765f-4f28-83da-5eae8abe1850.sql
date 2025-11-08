-- ============================================================================
-- ATOMIC RESTORE: Oct 24-25 Working Scheduler Baseline
-- ============================================================================
-- CRITICAL: This restores the LAST KNOWN WORKING state before gap-filler changes
-- SOURCE: DB dump from October 25, 2025 03:00 AM
-- VERIFIED: FIFO scheduling working perfectly, gap-filling disabled for now
-- ============================================================================

-- Step 1: Clean slate - drop all existing function versions
DROP FUNCTION IF EXISTS public.place_duration_sql(timestamp with time zone, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.find_available_gaps(uuid, integer, timestamp with time zone, integer, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamp with time zone, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.cron_nightly_reschedule_with_carryforward() CASCADE;

-- ============================================================================
-- FUNCTION 1: place_duration_sql
-- ============================================================================
CREATE FUNCTION public.place_duration_sql(
  p_earliest_start timestamp with time zone, 
  p_duration_minutes integer, 
  p_max_days integer DEFAULT 60
) RETURNS TABLE(
  placement_success boolean, 
  slots_created jsonb
)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
DECLARE
  current_day date;
  shift_info record;
  available_start timestamptz;
  remaining_minutes integer := p_duration_minutes;
  slots jsonb := '[]'::jsonb;
  day_count integer := 0;
  slot_start timestamptz;
  slot_end timestamptz;
  slot_duration integer;
  morning_capacity integer;
  afternoon_capacity integer;
BEGIN
  IF p_duration_minutes <= 0 THEN
    RETURN QUERY SELECT false, '[]'::jsonb;
    RETURN;
  END IF;

  available_start := public.next_working_start(p_earliest_start);
  current_day := available_start::date;

  WHILE remaining_minutes > 0 AND day_count < p_max_days LOOP
    day_count := day_count + 1;
    
    IF NOT public.is_working_day(current_day) THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
      CONTINUE;
    END IF;

    SELECT * INTO shift_info
    FROM public.shift_window_enhanced(current_day);
    
    IF shift_info.win_start IS NULL OR shift_info.win_end IS NULL THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
      CONTINUE;
    END IF;

    slot_start := GREATEST(available_start, shift_info.win_start);
    
    IF shift_info.has_lunch_break THEN
      IF slot_start < shift_info.lunch_start THEN
        morning_capacity := GREATEST(0, EXTRACT(epoch FROM (shift_info.lunch_start - slot_start)) / 60)::integer;
        IF morning_capacity > 0 THEN
          slot_duration := LEAST(remaining_minutes, morning_capacity);
          slot_end := slot_start + make_interval(mins => slot_duration);
          
          slots := slots || jsonb_build_object(
            'start_time', slot_start,
            'end_time', slot_end,
            'duration_minutes', slot_duration,
            'date', current_day
          );
          
          remaining_minutes := remaining_minutes - slot_duration;
        END IF;
        
        IF remaining_minutes > 0 AND shift_info.lunch_end < shift_info.win_end THEN
          afternoon_capacity := GREATEST(0, EXTRACT(epoch FROM (shift_info.win_end - shift_info.lunch_end)) / 60)::integer;
          IF afternoon_capacity > 0 THEN
            slot_duration := LEAST(remaining_minutes, afternoon_capacity);
            slot_end := shift_info.lunch_end + make_interval(mins => slot_duration);
            
            slots := slots || jsonb_build_object(
              'start_time', shift_info.lunch_end,
              'end_time', slot_end,
              'duration_minutes', slot_duration,
              'date', current_day
            );
            
            remaining_minutes := remaining_minutes - slot_duration;
          END IF;
        END IF;
      ELSE
        slot_start := GREATEST(slot_start, shift_info.lunch_end);
        IF slot_start < shift_info.win_end THEN
          afternoon_capacity := GREATEST(0, EXTRACT(epoch FROM (shift_info.win_end - slot_start)) / 60)::integer;
          IF afternoon_capacity > 0 THEN
            slot_duration := LEAST(remaining_minutes, afternoon_capacity);
            slot_end := slot_start + make_interval(mins => slot_duration);
            
            slots := slots || jsonb_build_object(
              'start_time', slot_start,
              'end_time', slot_end,
              'duration_minutes', slot_duration,
              'date', current_day
            );
            
            remaining_minutes := remaining_minutes - slot_duration;
          END IF;
        END IF;
      END IF;
    ELSE
      slot_duration := LEAST(remaining_minutes, GREATEST(0, EXTRACT(epoch FROM (shift_info.win_end - slot_start)) / 60)::integer);
      
      IF slot_duration > 0 THEN
        slot_end := slot_start + make_interval(mins => slot_duration);
        
        slots := slots || jsonb_build_object(
          'start_time', slot_start,
          'end_time', slot_end,
          'duration_minutes', slot_duration,
          'date', current_day
        );
        
        remaining_minutes := remaining_minutes - slot_duration;
      END IF;
    END IF;
    
    IF remaining_minutes > 0 THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
    END IF;
  END LOOP;

  RETURN QUERY SELECT (remaining_minutes = 0), slots;
END;
$$;

ALTER FUNCTION public.place_duration_sql(p_earliest_start timestamp with time zone, p_duration_minutes integer, p_max_days integer) OWNER TO postgres;

-- ============================================================================
-- FUNCTION 2: find_available_gaps
-- ============================================================================
CREATE FUNCTION public.find_available_gaps(
  p_stage_id uuid, 
  p_duration_minutes integer, 
  p_fifo_start_time timestamp with time zone, 
  p_lookback_days integer DEFAULT 21, 
  p_align_at timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS TABLE(
  gap_start timestamp with time zone, 
  gap_end timestamp with time zone, 
  gap_duration_minutes integer, 
  days_earlier numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_earliest_allowed_date date;
  scan_start_date date;
  scan_end_date date;
  day_win record;
  cur_start timestamptz;
  s record;
  effective_gap_minutes integer;
  is_occupied boolean;
BEGIN
  v_earliest_allowed_date := CURRENT_DATE;

  scan_start_date := GREATEST(
    (p_fifo_start_time - make_interval(days => p_lookback_days))::date,
    v_earliest_allowed_date,
    COALESCE(p_align_at::date, v_earliest_allowed_date)
  );

  scan_end_date := (p_fifo_start_time + interval '1 day')::date;

  FOR day_win IN
    SELECT sw.start_time AS win_start, sw.end_time AS win_end
    FROM public.shift_window_enhanced(scan_start_date, scan_end_date) sw
    ORDER BY sw.start_time
  LOOP
    cur_start := GREATEST(day_win.win_start, COALESCE(p_align_at, day_win.win_start));

    FOR s IN
      SELECT 
        GREATEST(sts.slot_start_time, day_win.win_start) AS s_start,
        LEAST(sts.slot_end_time, day_win.win_end) AS s_end
      FROM public.stage_time_slots sts
      WHERE sts.production_stage_id = p_stage_id
        AND COALESCE(sts.is_completed, false) = false
        AND sts.slot_start_time < day_win.win_end
        AND sts.slot_end_time > day_win.win_start
      ORDER BY sts.slot_start_time
    LOOP
      IF cur_start < s.s_start THEN
        effective_gap_minutes := FLOOR(EXTRACT(EPOCH FROM (s.s_start - cur_start)) / 60)::integer;
        IF effective_gap_minutes >= p_duration_minutes THEN
          SELECT EXISTS(
            SELECT 1 FROM stage_time_slots 
            WHERE production_stage_id = p_stage_id 
              AND slot_start_time = cur_start
              AND COALESCE(is_completed, false) = false
          ) INTO is_occupied;
          
          IF NOT is_occupied THEN
            gap_start := cur_start;
            gap_end := s.s_start;
            gap_duration_minutes := effective_gap_minutes;
            days_earlier := EXTRACT(EPOCH FROM (p_fifo_start_time - gap_start)) / 86400.0;
            RETURN NEXT;
          END IF;
        END IF;
      END IF;

      IF s.s_end > cur_start THEN
        cur_start := s.s_end;
      END IF;

      IF cur_start >= day_win.win_end THEN
        EXIT;
      END IF;
    END LOOP;

    IF cur_start < day_win.win_end THEN
      effective_gap_minutes := FLOOR(EXTRACT(EPOCH FROM (day_win.win_end - cur_start)) / 60)::integer;
      IF effective_gap_minutes >= p_duration_minutes THEN
        SELECT EXISTS(
          SELECT 1 FROM stage_time_slots 
          WHERE production_stage_id = p_stage_id 
            AND slot_start_time = cur_start
            AND COALESCE(is_completed, false) = false
        ) INTO is_occupied;
        
        IF NOT is_occupied THEN
          gap_start := cur_start;
          gap_end := day_win.win_end;
          gap_duration_minutes := effective_gap_minutes;
          days_earlier := EXTRACT(EPOCH FROM (p_fifo_start_time - gap_start)) / 86400.0;
          RETURN NEXT;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION public.find_available_gaps(p_stage_id uuid, p_duration_minutes integer, p_fifo_start_time timestamp with time zone, p_lookback_days integer, p_align_at timestamp with time zone) OWNER TO postgres;

-- ============================================================================
-- FUNCTION 3: scheduler_reschedule_all_parallel_aware
-- CRITICAL: Returns TABLE not JSONB!
-- ============================================================================
CREATE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS TABLE(
  wrote_slots integer, 
  updated_jsi integer, 
  violations jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  
  r_job record;
  r_stage_group record;
  r_stage record;
  
  job_stage_barriers jsonb := '{}'::jsonb;
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  
  completed_barriers jsonb;
  cover_barrier_time timestamptz;
  text_barrier_time timestamptz;
  main_barrier_time timestamptz;
  barrier_key text;
  
  predecessor_end timestamptz;
  
  expired_count integer := 0;
  on_hold_count integer := 0;
  
  v_rows integer := 0;
  stage_start_time timestamptz;
BEGIN
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now()) + interval '1 day');
    RAISE NOTICE '🔄 Manual reschedule starting from TOMORROW: %', base_time;
  ELSE
    base_time := public.next_working_start(p_start_from);
    RAISE NOTICE '🔄 Scheduled reschedule starting from: %', base_time;
  END IF;

  DELETE FROM stage_time_slots
  WHERE COALESCE(is_completed, false) = false
    AND slot_start_time >= base_time;

  expired_count := (SELECT COUNT(*)::integer 
    FROM job_stage_instances 
    WHERE schedule_status IN ('scheduled', 'auto_held')
      AND scheduled_start_at < now() - interval '7 days');
  
  UPDATE job_stage_instances
  SET schedule_status = 'expired',
      scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = NULL,
      updated_at = now()
  WHERE schedule_status IN ('scheduled', 'auto_held')
    AND scheduled_start_at < now() - interval '7 days';

  on_hold_count := (SELECT COUNT(*)::integer 
    FROM job_stage_instances 
    WHERE status = 'on_hold');
  
  UPDATE job_stage_instances
  SET schedule_status = 'unscheduled',
      scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = NULL,
      updated_at = now()
  WHERE status IN ('pending', 'on_hold')
    AND schedule_status != 'expired';

  PERFORM public.create_stage_availability_tracker();

  completed_barriers := (
    SELECT jsonb_object_agg(job_id::text,
      jsonb_build_object(
        'main', COALESCE(main_end, base_time),
        'cover', COALESCE(cover_end, base_time),
        'text', COALESCE(text_end, base_time),
        'both', COALESCE(both_end, base_time)
      )
    )
    FROM (
      SELECT
        jsi.job_id,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment = 'both') AS both_end,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('cover', 'both')) AS cover_end,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('text', 'both')) AS text_end,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment = 'both') AS main_end
      FROM stage_time_slots sts
      JOIN job_stage_instances jsi ON jsi.id = sts.stage_instance_id
      WHERE sts.is_completed = true
      GROUP BY jsi.job_id
    ) s
  );

  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    COALESCE(MAX(slot_end_time), base_time)
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE '📋 Phase 1: FIFO Scheduling starting...';
  
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.category_id
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM job_stage_instances jsi 
        WHERE jsi.job_id = pj.id 
          AND jsi.status IN ('pending', 'active', 'on_hold')
      )
    ORDER BY pj.proof_approved_at ASC
  LOOP
    job_stage_barriers := COALESCE(
      completed_barriers -> r_job.job_id::text,
      jsonb_build_object(
        'main', GREATEST(base_time, r_job.proof_approved_at),
        'cover', GREATEST(base_time, r_job.proof_approved_at),
        'text', GREATEST(base_time, r_job.proof_approved_at),
        'both', GREATEST(base_time, r_job.proof_approved_at)
      )
    );
    
    FOR r_stage_group IN
      SELECT 
        stage_order,
        array_agg(jsi.id) as stage_instance_ids
      FROM job_stage_instances jsi
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold')
      GROUP BY stage_order
      ORDER BY stage_order ASC
    LOOP
      FOR r_stage IN
        SELECT 
          jsi.id as stage_instance_id,
          jsi.production_stage_id,
          jsi.stage_order,
          jsi.part_assignment,
          jsi.status,
          public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes, jsi.remaining_minutes, jsi.completion_percentage) as duration_minutes,
          ps.name as stage_name
        FROM job_stage_instances jsi
        JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.id = ANY(r_stage_group.stage_instance_ids)
        ORDER BY jsi.id
      LOOP
        IF r_stage.duration_minutes IS NULL OR r_stage.duration_minutes <= 0 THEN
          RAISE WARNING '⚠️ INVALID DURATION for job % (WO: %), stage %: duration=% mins. Skipping.', 
            r_job.job_id, r_job.wo_no, r_stage.stage_name, r_stage.duration_minutes;
          CONTINUE;
        END IF;
        
        IF r_stage.part_assignment = 'both' THEN
          cover_barrier_time := COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          text_barrier_time := COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          main_barrier_time := COALESCE((job_stage_barriers->>'main')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          
          stage_earliest_start := GREATEST(cover_barrier_time, text_barrier_time, main_barrier_time);
          barrier_key := 'both';
        ELSE
          barrier_key := COALESCE(r_stage.part_assignment, 'main');
          
          IF NOT job_stage_barriers ? barrier_key THEN
            job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(GREATEST(base_time, r_job.proof_approved_at)));
          END IF;
          
          stage_earliest_start := (job_stage_barriers ->> barrier_key)::timestamptz;
        END IF;

        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
        FROM job_stage_instances jsi2
        WHERE jsi2.job_id = r_job.job_id
          AND jsi2.stage_order < r_stage.stage_order
          AND jsi2.scheduled_end_at IS NOT NULL
          AND (
            r_stage.part_assignment = 'both'
            OR
            (COALESCE(r_stage.part_assignment, 'main') = 'text' 
             AND jsi2.part_assignment IN ('text', 'both'))
            OR
            (COALESCE(r_stage.part_assignment, 'main') = 'cover' 
             AND jsi2.part_assignment IN ('cover', 'both'))
            OR
            (COALESCE(r_stage.part_assignment, 'main') = 'main' 
             AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
          );

        IF predecessor_end IS NOT NULL AND predecessor_end > stage_earliest_start THEN
          RAISE NOTICE '🔒 Job % (WO: %) stage % (part=%, order %): waiting for %+both predecessor. New earliest: %',
            r_job.job_id, r_job.wo_no, r_stage.stage_name, COALESCE(r_stage.part_assignment, 'main'), 
            r_stage.stage_order, COALESCE(r_stage.part_assignment, 'main'), predecessor_end;
          stage_earliest_start := predecessor_end;
        END IF;

        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes, 60);
        
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE WARNING '⚠️ FAILED to schedule stage % for job %, skipping', r_stage.stage_name, r_job.job_id;
          CONTINUE;
        END IF;

        FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
        LOOP
          INSERT INTO stage_time_slots(
            production_stage_id, date, slot_start_time, slot_end_time,
            duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
          )
          VALUES (
            r_stage.production_stage_id,
            (slot_record ->> 'date')::date,
            (slot_record ->> 'start_time')::timestamptz,
            (slot_record ->> 'end_time')::timestamptz,
            (slot_record ->> 'duration_minutes')::integer,
            r_job.job_id, 'production_jobs', r_stage.stage_instance_id, false
          )
          ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING;
          
          GET DIAGNOSTICS v_rows = ROW_COUNT;
          IF v_rows = 1 THEN
            wrote_count := wrote_count + 1;
          ELSE
            RAISE NOTICE '⏭️ Phase 1 skipped conflicting slot: stage %, start %', 
              r_stage.production_stage_id, (slot_record->>'start_time')::timestamptz;
          END IF;
        END LOOP;

        SELECT MIN(slot_start_time), MAX(slot_end_time)
        INTO stage_start_time, stage_end_time
        FROM stage_time_slots
        WHERE stage_instance_id = r_stage.stage_instance_id
          AND COALESCE(is_completed, false) = false;

        IF stage_end_time IS NULL THEN
          RAISE NOTICE '⏭️ No slots inserted for stage % (Phase 1), skipping updates', r_stage.stage_instance_id;
          CONTINUE;
        END IF;

        UPDATE _stage_tails 
        SET next_available_time = stage_end_time
        WHERE stage_id = r_stage.production_stage_id;

        UPDATE job_stage_instances
        SET 
          scheduled_minutes = r_stage.duration_minutes,
          scheduled_start_at = stage_start_time,
          scheduled_end_at = stage_end_time,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = r_stage.stage_instance_id;
        updated_count := updated_count + 1;

        job_stage_barriers := jsonb_set(
          job_stage_barriers,
          ARRAY[barrier_key],
          to_jsonb(stage_end_time)
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ Phase 1 complete: % slots written, % stages scheduled', wrote_count, updated_count;
  
  RETURN QUERY SELECT wrote_count, updated_count, validation_results;
END;
$$;

ALTER FUNCTION public.scheduler_reschedule_all_parallel_aware(p_start_from timestamp with time zone) OWNER TO postgres;

-- ============================================================================
-- FUNCTION 4: simple_scheduler_wrapper
-- ============================================================================
CREATE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all'::text, 
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '180s'
SET idle_in_transaction_session_timeout TO '300s'
AS $$
DECLARE
  result record;
  response jsonb;
BEGIN
  SET LOCAL statement_timeout = '120s';
  SET LOCAL idle_in_transaction_session_timeout = '300s';
  
  CASE p_mode
    WHEN 'reschedule_all' THEN
      SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware(p_start_from);
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'violations', result.violations,
        'mode', 'parallel_aware'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  RETURN response;
END;
$$;

ALTER FUNCTION public.simple_scheduler_wrapper(p_mode text, p_start_from timestamp with time zone) OWNER TO postgres;

-- ============================================================================
-- FUNCTION 5: cron_nightly_reschedule_with_carryforward
-- ============================================================================
CREATE FUNCTION public.cron_nightly_reschedule_with_carryforward() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  response_id bigint;
  service_key text;
BEGIN
  RAISE NOTICE '🌙 Nightly cron starting at %', now();
  
  UPDATE production_jobs 
  SET status = 'In Production'
  WHERE status = 'Approved' 
    AND due_date < CURRENT_DATE;
  
  RAISE NOTICE '📞 Calling simple-scheduler edge function (nuclear reschedule)';
  
  SELECT value INTO service_key
  FROM public._app_secrets
  WHERE key = 'service_role_key';
  
  IF service_key IS NULL THEN
    RAISE WARNING '⚠️ Service role key not found in _app_secrets table';
    RETURN;
  END IF;
  
  SELECT net.http_post(
    url := 'https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/simple-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'commit', true,
      'proposed', false,
      'onlyIfUnset', false,
      'nuclear', true,
      'wipeAll', true
    )
  ) INTO response_id;
  
  RAISE NOTICE '✅ Edge function called, response_id: %', response_id;
END;
$$;

ALTER FUNCTION public.cron_nightly_reschedule_with_carryforward() OWNER TO postgres;

-- ============================================================================
-- SUCCESS VERIFICATION
-- ============================================================================
-- To verify restoration, run:
-- SELECT public.simple_scheduler_wrapper('reschedule_all', now()::timestamptz);
-- Expected: JSONB with wrote_slots, scheduled_count, violations keys
-- ============================================================================