-- Add Phase 2 Gap-Filling to scheduler (no duration restriction)
-- Modified from restore_oct_24_working_scheduler_part3.sql

DROP FUNCTION IF EXISTS scheduler_reschedule_all_parallel_aware(timestamptz);

CREATE OR REPLACE FUNCTION scheduler_reschedule_all_parallel_aware(
  p_start_from timestamptz DEFAULT now()
)
RETURNS TABLE(
  wrote_slots integer,
  updated_jsi integer,
  violations jsonb,
  gap_filled_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  gap_filled_count integer := 0;
  
  v_lookback_days integer := 90;
  moved_count integer;
  pass_iteration integer;
  gap_candidate record;
  original_start timestamptz;
  earliest_possible_start timestamptz;
  best_gap record;
  days_saved numeric;
  gap_filled_end timestamptz;
  
  job_rec record;
  stage_rec record;
  current_earliest timestamptz;
  resource_avail timestamptz;
  place_result record;
  stage_duration_minutes integer;
  new_start timestamptz;
  new_end timestamptz;
  stage_order_val integer;
  prev_stage record;
  dep_end timestamptz;
BEGIN
  -- Phase 1: FIFO scheduling
  FOR job_rec IN
    SELECT 
      j.id as job_id,
      j.proof_approved_at,
      j.due_date,
      j.wo_number
    FROM production_jobs j
    WHERE j.proof_approved_at IS NOT NULL
      AND j.status IN ('Approved', 'In Production')
    ORDER BY j.proof_approved_at, j.due_date NULLS LAST
  LOOP
    CREATE TEMP TABLE IF NOT EXISTS _stage_tails (
      production_stage_id uuid PRIMARY KEY,
      tail_time timestamptz NOT NULL
    ) ON COMMIT DROP;
    DELETE FROM _stage_tails;

    FOR stage_rec IN
      SELECT
        jsi.id,
        jsi.production_stage_id,
        jsi.stage_order,
        COALESCE(jsi.estimated_duration_minutes, 0) + COALESCE(jsi.setup_minutes, 0) as total_minutes
      FROM job_stage_instances jsi
      WHERE jsi.job_id = job_rec.job_id
      ORDER BY jsi.stage_order NULLS LAST, jsi.id
    LOOP
      stage_order_val := COALESCE(stage_rec.stage_order, 9999);
      current_earliest := job_rec.proof_approved_at;

      FOR prev_stage IN
        SELECT jsi2.id, jsi2.stage_order
        FROM job_stage_instances jsi2
        WHERE jsi2.job_id = job_rec.job_id
          AND COALESCE(jsi2.stage_order, 9999) < stage_order_val
      LOOP
        SELECT st.tail_time INTO dep_end
        FROM _stage_tails st
        WHERE st.production_stage_id = stage_rec.production_stage_id;
        
        IF dep_end IS NOT NULL AND dep_end > current_earliest THEN
          current_earliest := dep_end;
        END IF;
      END LOOP;

      SELECT st.tail_time INTO resource_avail
      FROM _stage_tails st
      WHERE st.production_stage_id = stage_rec.production_stage_id;

      IF resource_avail IS NOT NULL AND resource_avail > current_earliest THEN
        current_earliest := resource_avail;
      END IF;

      stage_duration_minutes := stage_rec.total_minutes;

      SELECT * INTO place_result
      FROM place_duration_sql(current_earliest, stage_duration_minutes, 60);

      IF place_result.success THEN
        new_start := (place_result.time_slots[1])."start";
        new_end := (place_result.time_slots[array_upper(place_result.time_slots, 1)])."end";

        DELETE FROM stage_time_slots
        WHERE job_stage_instance_id = stage_rec.id;

        INSERT INTO stage_time_slots (production_stage_id, job_stage_instance_id, slot_start_time, slot_end_time, duration_minutes)
        SELECT 
          stage_rec.production_stage_id,
          stage_rec.id,
          slot."start",
          slot."end",
          EXTRACT(EPOCH FROM (slot."end" - slot."start"))/60
        FROM unnest(place_result.time_slots) AS slot;

        wrote_count := wrote_count + array_length(place_result.time_slots, 1);

        UPDATE job_stage_instances
        SET scheduled_start_at = new_start,
            scheduled_end_at = new_end,
            scheduled_minutes = stage_duration_minutes,
            schedule_status = 'scheduled'
        WHERE id = stage_rec.id;

        updated_count := updated_count + 1;

        INSERT INTO _stage_tails (production_stage_id, tail_time)
        VALUES (stage_rec.production_stage_id, new_end)
        ON CONFLICT (production_stage_id)
        DO UPDATE SET tail_time = EXCLUDED.tail_time;
      END IF;
    END LOOP;
  END LOOP;

  -- Phase 2: Gap-filling (NO duration restriction)
  FOR pass_iteration IN 1..3 LOOP
    moved_count := 0;

    FOR gap_candidate IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.job_id,
        jsi.production_stage_id,
        jsi.stage_order,
        jsi.scheduled_start_at as original_start,
        jsi.scheduled_minutes,
        jsi.part_assignment,
        pj.proof_approved_at,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      JOIN production_jobs pj ON pj.id = jsi.job_id
      WHERE jsi.schedule_status = 'scheduled'
        AND ps.allow_gap_filling = true
        AND jsi.scheduled_start_at IS NOT NULL
      ORDER BY jsi.job_id, jsi.stage_order, jsi.scheduled_start_at
    LOOP
      original_start := gap_candidate.original_start;
      earliest_possible_start := gap_candidate.proof_approved_at;

      -- Part-aware predecessor check
      FOR prev_stage IN
        SELECT 
          jsi2.id,
          jsi2.scheduled_end_at,
          jsi2.part_assignment
        FROM job_stage_instances jsi2
        WHERE jsi2.job_id = gap_candidate.job_id
          AND COALESCE(jsi2.stage_order, 9999) < COALESCE(gap_candidate.stage_order, 9999)
          AND jsi2.scheduled_end_at IS NOT NULL
      LOOP
        IF gap_candidate.part_assignment = 'both' THEN
          IF prev_stage.scheduled_end_at > earliest_possible_start THEN
            earliest_possible_start := prev_stage.scheduled_end_at;
          END IF;
        ELSIF gap_candidate.part_assignment = 'text' THEN
          IF prev_stage.part_assignment IN ('text', 'both') AND prev_stage.scheduled_end_at > earliest_possible_start THEN
            earliest_possible_start := prev_stage.scheduled_end_at;
          END IF;
        ELSIF gap_candidate.part_assignment = 'cover' THEN
          IF prev_stage.part_assignment IN ('cover', 'both') AND prev_stage.scheduled_end_at > earliest_possible_start THEN
            earliest_possible_start := prev_stage.scheduled_end_at;
          END IF;
        ELSE
          IF prev_stage.part_assignment IN ('main', 'both') OR prev_stage.part_assignment IS NULL THEN
            IF prev_stage.scheduled_end_at > earliest_possible_start THEN
              earliest_possible_start := prev_stage.scheduled_end_at;
            END IF;
          END IF;
        END IF;
      END LOOP;

      -- Find best available gap
      SELECT * INTO best_gap
      FROM find_available_gaps(
        gap_candidate.production_stage_id,
        gap_candidate.scheduled_minutes,
        earliest_possible_start,
        original_start,
        v_lookback_days
      )
      WHERE gap_start >= earliest_possible_start
        AND gap_start < original_start
      ORDER BY gap_start
      LIMIT 1;

      IF best_gap.gap_start IS NOT NULL THEN
        DELETE FROM stage_time_slots
        WHERE job_stage_instance_id = gap_candidate.stage_instance_id;

        SELECT * INTO place_result
        FROM place_duration_sql(best_gap.gap_start, gap_candidate.scheduled_minutes, 60);

        IF place_result.success THEN
          INSERT INTO stage_time_slots (
            production_stage_id,
            job_stage_instance_id,
            slot_start_time,
            slot_end_time,
            duration_minutes
          )
          SELECT
            gap_candidate.production_stage_id,
            gap_candidate.stage_instance_id,
            slot."start",
            slot."end",
            EXTRACT(EPOCH FROM (slot."end" - slot."start"))/60
          FROM unnest(place_result.time_slots) AS slot
          ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING;

          gap_filled_end := (place_result.time_slots[array_upper(place_result.time_slots, 1)])."end";

          UPDATE job_stage_instances
          SET scheduled_start_at = best_gap.gap_start,
              scheduled_end_at = gap_filled_end,
              schedule_status = 'scheduled'
          WHERE id = gap_candidate.stage_instance_id;

          days_saved := EXTRACT(EPOCH FROM (original_start - best_gap.gap_start)) / 86400.0;

          INSERT INTO schedule_gap_fills (
            job_id,
            job_stage_instance_id,
            production_stage_id,
            original_start_at,
            gap_filled_start_at,
            days_saved,
            pass_number
          ) VALUES (
            gap_candidate.job_id,
            gap_candidate.stage_instance_id,
            gap_candidate.production_stage_id,
            original_start,
            best_gap.gap_start,
            days_saved,
            pass_iteration
          );

          gap_filled_count := gap_filled_count + 1;
          moved_count := moved_count + 1;

          RAISE NOTICE 'Gap-filled: % [%min] moved %.1f days earlier (pass %)', 
            gap_candidate.stage_name, gap_candidate.scheduled_minutes, days_saved, pass_iteration;
        END IF;
      END IF;
    END LOOP;

    IF moved_count = 0 THEN
      EXIT;
    END IF;
  END LOOP;

  -- Validation
  SELECT jsonb_agg(
    jsonb_build_object(
      'job_id', v.job_id,
      'stage_instance_id', v.stage_instance_id,
      'stage_name', v.stage_name,
      'violation', v.violation_type
    )
  ) INTO validation_results
  FROM (
    SELECT DISTINCT
      jsi.job_id,
      jsi.id as stage_instance_id,
      ps.name as stage_name,
      'predecessor_overlap' as violation_type
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.schedule_status = 'scheduled'
      AND jsi.scheduled_start_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM job_stage_instances pred
        WHERE pred.job_id = jsi.job_id
          AND COALESCE(pred.stage_order, 9999) < COALESCE(jsi.stage_order, 9999)
          AND pred.scheduled_end_at > jsi.scheduled_start_at
      )
  ) v;

  validation_results := COALESCE(validation_results, '[]'::jsonb);

  RETURN QUERY SELECT wrote_count, updated_count, validation_results, gap_filled_count;
END;
$$;