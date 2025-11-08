-- ============================================================================
-- SCHEDULER RESTORATION - October 24-25, 2025 WORKING STATE
-- ============================================================================
-- SOURCE: DB Dump from October 25, 2025 03:00 AM
-- PURPOSE: Restore the exact working scheduler functions that were operational
--          before subsequent breaking changes were introduced
-- ============================================================================

-- Drop existing functions cleanly
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.find_available_gaps(uuid, integer, timestamp with time zone, integer, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.cron_nightly_reschedule_with_carryforward() CASCADE;
DROP FUNCTION IF EXISTS public.place_duration_sql(timestamp with time zone, integer, integer) CASCADE;

-- ============================================================================
-- 1. place_duration_sql
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

-- ============================================================================
-- 2. find_available_gaps
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
        LEAST(sts.slot_end_time,   day_win.win_end)       AS s_end
      FROM public.stage_time_slots sts
      WHERE sts.production_stage_id = p_stage_id
        AND COALESCE(sts.is_completed, false) = false
        AND sts.slot_start_time < day_win.win_end
        AND sts.slot_end_time   > day_win.win_start
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

-- ============================================================================
-- 3. scheduler_reschedule_all_parallel_aware (Phase 1 FIFO + Phase 2 Gap-Filling)
-- ============================================================================

CREATE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_from timestamptz;
  v_job record;
  v_stage record;
  v_earliest_start timestamptz;
  v_total_minutes integer;
  v_placement record;
  v_slot jsonb;
  v_updated_count integer := 0;
  v_wrote_slots integer := 0;
  v_stage_resource_ends jsonb := '{}'::jsonb;
  v_resource_id uuid;
  v_last_end timestamptz;
  v_violations jsonb := '[]'::jsonb;
  v_gap_candidates jsonb := '[]'::jsonb;
  v_gap record;
  v_gap_filled_count integer := 0;
  v_iteration integer := 0;
  v_max_iterations integer := 3;
BEGIN
  v_start_from := COALESCE(p_start_from, public.next_working_start(CURRENT_TIMESTAMP));

  -- ============================================================================
  -- PHASE 1: FIFO Scheduling (Proof-Approved Order)
  -- ============================================================================
  
  FOR v_job IN
    SELECT 
      pj.id AS job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.qty,
      pj.part_count
    FROM production_jobs pj
    WHERE pj.status IN ('active', 'pending')
      AND pj.proof_approved_at IS NOT NULL
    ORDER BY pj.proof_approved_at ASC
  LOOP
    FOR v_stage IN
      SELECT 
        jsi.id AS jsi_id,
        jsi.production_stage_id,
        jsi.stage_order,
        jsi.part_assignment,
        ps.name AS stage_name,
        ps.estimated_minutes_per_unit,
        ps.setup_minutes,
        ps.allow_parallel_processing
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = v_job.job_id
        AND jsi.status = 'pending'
      ORDER BY jsi.stage_order ASC
    LOOP
      v_resource_id := v_stage.production_stage_id;

      v_earliest_start := v_start_from;

      IF v_stage.stage_order > 1 THEN
        SELECT MAX(jsi2.scheduled_end_at) INTO v_last_end
        FROM job_stage_instances jsi2
        WHERE jsi2.job_id = v_job.job_id
          AND jsi2.stage_order < v_stage.stage_order
          AND (
            v_stage.part_assignment = 'both'
            OR jsi2.part_assignment = 'both'
            OR jsi2.part_assignment = v_stage.part_assignment
          );
        
        IF v_last_end IS NOT NULL THEN
          v_earliest_start := GREATEST(v_earliest_start, v_last_end);
        END IF;
      ELSE
        v_earliest_start := GREATEST(v_earliest_start, v_job.proof_approved_at);
      END IF;

      IF NOT COALESCE(v_stage.allow_parallel_processing, false) THEN
        IF (v_stage_resource_ends->>v_resource_id::text) IS NOT NULL THEN
          v_last_end := (v_stage_resource_ends->>v_resource_id::text)::timestamptz;
          v_earliest_start := GREATEST(v_earliest_start, v_last_end);
        END IF;
      END IF;

      v_total_minutes := COALESCE(v_stage.setup_minutes, 0) + 
                         COALESCE(v_stage.estimated_minutes_per_unit, 0) * v_job.qty;

      SELECT * INTO v_placement
      FROM public.place_duration_sql(v_earliest_start, v_total_minutes, 60);

      IF v_placement.placement_success THEN
        DELETE FROM stage_time_slots 
        WHERE job_stage_instance_id = v_stage.jsi_id;

        FOR v_slot IN SELECT * FROM jsonb_array_elements(v_placement.slots_created)
        LOOP
          INSERT INTO stage_time_slots (
            job_stage_instance_id,
            production_stage_id,
            slot_start_time,
            slot_end_time,
            duration_minutes,
            is_completed
          ) VALUES (
            v_stage.jsi_id,
            v_stage.production_stage_id,
            (v_slot->>'start_time')::timestamptz,
            (v_slot->>'end_time')::timestamptz,
            (v_slot->>'duration_minutes')::integer,
            false
          );
          v_wrote_slots := v_wrote_slots + 1;
        END LOOP;

        UPDATE job_stage_instances
        SET 
          scheduled_start_at = (v_placement.slots_created->0->>'start_time')::timestamptz,
          scheduled_end_at = (v_placement.slots_created->-1->>'end_time')::timestamptz
        WHERE id = v_stage.jsi_id;

        v_updated_count := v_updated_count + 1;

        IF NOT COALESCE(v_stage.allow_parallel_processing, false) THEN
          v_stage_resource_ends := jsonb_set(
            v_stage_resource_ends,
            ARRAY[v_resource_id::text],
            to_jsonb((v_placement.slots_created->-1->>'end_time')::timestamptz)
          );
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- ============================================================================
  -- PHASE 2: Gap-Filling (Move short stages to earlier gaps)
  -- ============================================================================
  
  WHILE v_iteration < v_max_iterations LOOP
    v_iteration := v_iteration + 1;
    v_gap_candidates := '[]'::jsonb;

    FOR v_stage IN
      SELECT 
        jsi.id AS jsi_id,
        jsi.production_stage_id,
        jsi.scheduled_start_at AS current_start,
        ps.name AS stage_name,
        ps.estimated_minutes_per_unit,
        ps.setup_minutes,
        ps.allow_gap_filling,
        pj.qty,
        pj.wo_no
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      JOIN production_jobs pj ON pj.id = jsi.job_id
      WHERE jsi.status = 'pending'
        AND jsi.scheduled_start_at IS NOT NULL
        AND COALESCE(ps.allow_gap_filling, false) = true
      ORDER BY jsi.scheduled_start_at DESC
    LOOP
      v_total_minutes := COALESCE(v_stage.setup_minutes, 0) + 
                         COALESCE(v_stage.estimated_minutes_per_unit, 0) * v_stage.qty;

      IF v_total_minutes > 120 THEN
        CONTINUE;
      END IF;

      FOR v_gap IN
        SELECT 
          gap_start,
          gap_end,
          gap_duration_minutes,
          days_earlier
        FROM public.find_available_gaps(
          v_stage.production_stage_id,
          v_total_minutes,
          v_stage.current_start,
          21,
          v_start_from
        )
        ORDER BY days_earlier DESC
        LIMIT 1
      LOOP
        IF v_gap.days_earlier >= 0.5 THEN
          v_gap_candidates := v_gap_candidates || jsonb_build_object(
            'jsi_id', v_stage.jsi_id,
            'stage_name', v_stage.stage_name,
            'wo_no', v_stage.wo_no,
            'gap_start', v_gap.gap_start,
            'days_saved', v_gap.days_earlier,
            'duration_minutes', v_total_minutes
          );
        END IF;
      END LOOP;
    END LOOP;

    IF jsonb_array_length(v_gap_candidates) = 0 THEN
      EXIT;
    END IF;

    FOR v_slot IN SELECT * FROM jsonb_array_elements(v_gap_candidates) LIMIT 20
    LOOP
      SELECT * INTO v_placement
      FROM public.place_duration_sql(
        (v_slot->>'gap_start')::timestamptz,
        (v_slot->>'duration_minutes')::integer,
        60
      );

      IF v_placement.placement_success THEN
        DELETE FROM stage_time_slots 
        WHERE job_stage_instance_id = (v_slot->>'jsi_id')::uuid;

        FOR v_slot IN SELECT * FROM jsonb_array_elements(v_placement.slots_created)
        LOOP
          INSERT INTO stage_time_slots (
            job_stage_instance_id,
            production_stage_id,
            slot_start_time,
            slot_end_time,
            duration_minutes,
            is_completed
          ) VALUES (
            (v_slot->>'jsi_id')::uuid,
            v_stage.production_stage_id,
            (v_slot->>'start_time')::timestamptz,
            (v_slot->>'end_time')::timestamptz,
            (v_slot->>'duration_minutes')::integer,
            false
          );
        END LOOP;

        UPDATE job_stage_instances
        SET 
          scheduled_start_at = (v_placement.slots_created->0->>'start_time')::timestamptz,
          scheduled_end_at = (v_placement.slots_created->-1->>'end_time')::timestamptz
        WHERE id = (v_slot->>'jsi_id')::uuid;

        INSERT INTO schedule_gap_fills (
          job_stage_instance_id,
          original_start_time,
          new_start_time,
          days_saved,
          scheduler_run_type
        ) VALUES (
          (v_slot->>'jsi_id')::uuid,
          v_stage.current_start,
          (v_placement.slots_created->0->>'start_time')::timestamptz,
          (v_slot->>'days_saved')::numeric,
          'reschedule_all'
        );

        v_gap_filled_count := v_gap_filled_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_jsi', v_updated_count,
    'wrote_slots', v_wrote_slots,
    'gap_filled', v_gap_filled_count,
    'violations', v_violations
  );
END;
$$;

-- ============================================================================
-- 4. simple_scheduler_wrapper (Timeout Protection)
-- ============================================================================

CREATE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all'::text, 
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_start_time timestamptz := clock_timestamp();
  v_timeout interval := '30 seconds'::interval;
BEGIN
  IF p_mode = 'reschedule_all' THEN
    v_result := public.scheduler_reschedule_all_parallel_aware(p_start_from);
  ELSE
    RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END IF;

  IF clock_timestamp() - v_start_time > v_timeout THEN
    RAISE WARNING 'Scheduler exceeded timeout of %', v_timeout;
  END IF;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );
END;
$$;

-- ============================================================================
-- 5. cron_nightly_reschedule_with_carryforward
-- ============================================================================

CREATE FUNCTION public.cron_nightly_reschedule_with_carryforward() 
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_carry_forward_result jsonb;
  v_reschedule_result jsonb;
BEGIN
  SELECT row_to_json(r)::jsonb INTO v_carry_forward_result
  FROM (SELECT * FROM public.carry_forward_overdue_active_jobs()) r;

  v_reschedule_result := public.simple_scheduler_wrapper('reschedule_all', NULL);

  RETURN jsonb_build_object(
    'carry_forward', v_carry_forward_result,
    'reschedule', v_reschedule_result,
    'timestamp', now()
  );
END;
$$;

-- Add ownership
ALTER FUNCTION public.place_duration_sql(timestamp with time zone, integer, integer) OWNER TO postgres;
ALTER FUNCTION public.find_available_gaps(uuid, integer, timestamp with time zone, integer, timestamp with time zone) OWNER TO postgres;
ALTER FUNCTION public.scheduler_reschedule_all_parallel_aware(timestamp with time zone) OWNER TO postgres;
ALTER FUNCTION public.simple_scheduler_wrapper(text, timestamp with time zone) OWNER TO postgres;
ALTER FUNCTION public.cron_nightly_reschedule_with_carryforward() OWNER TO postgres;