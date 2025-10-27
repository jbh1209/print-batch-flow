-- Migration: Exclude DTP, PROOF, and BATCH ALLOCATION stages from all scheduling logic
-- This ensures only actual production stages are scheduled

-- Drop existing functions
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_by_division(TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(UUID[], BOOLEAN, TEXT);

-- Recreate scheduler_reschedule_all_by_division with DTP/PROOF filters
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_by_division(
  p_division TEXT DEFAULT NULL,
  p_base_start TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_start TIMESTAMPTZ;
  v_min_future_threshold TIMESTAMPTZ;
  v_current_time TIMESTAMPTZ;
  v_slots_written INT := 0;
  v_jobs_touched INT := 0;
  v_current_stage_start TIMESTAMPTZ;
  v_current_stage_end TIMESTAMPTZ;
  v_slot_duration_minutes INT := 60;
  v_next_avail TIMESTAMPTZ;
  v_stage_remaining_minutes INT;
  v_stage_placed_minutes INT;
  v_factory_tz TEXT := 'Africa/Johannesburg';
  r_job RECORD;
  r_stage_group RECORD;
  r_stage RECORD;
  gap_candidate RECORD;
  v_job_ids UUID[] := '{}';
BEGIN
  v_current_time := NOW() AT TIME ZONE v_factory_tz;
  v_base_start := COALESCE(p_base_start, v_current_time);
  v_min_future_threshold := v_base_start;

  RAISE NOTICE '[SCHEDULER_RESCHEDULE_ALL] Starting with base_start=%, division=%', v_base_start, p_division;

  -- Clear scheduled times for reschedulable stages (excluding DTP/PROOF)
  UPDATE job_stage_instances jsi
  SET scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = NULL,
      schedule_status = 'pending'
  FROM production_stages ps
  WHERE jsi.production_stage_id = ps.id
    AND jsi.status IN ('pending', 'active', 'on_hold')
    AND LOWER(ps.name) NOT LIKE '%dtp%'
    AND LOWER(ps.name) NOT LIKE '%proof%'
    AND LOWER(ps.name) NOT LIKE '%batch%allocation%'
    AND (p_division IS NULL OR ps.division = p_division);

  RAISE NOTICE '[SCHEDULER_RESCHEDULE_ALL] Cleared scheduled times for reschedulable stages';

  -- Main job loop - FILTER OUT DTP/PROOF STAGES
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.proof_approved_at,
      pj.wo_no,
      COUNT(DISTINCT jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE pj.proof_approved_at IS NOT NULL
      AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      AND LOWER(ps.name) NOT LIKE '%dtp%'
      AND LOWER(ps.name) NOT LIKE '%proof%'
      AND LOWER(ps.name) NOT LIKE '%batch%allocation%'
      AND (p_division IS NULL OR ps.division = p_division)
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    RAISE NOTICE '[JOB: %] Processing job with % stages', r_job.wo_no, r_job.total_stages;
    v_job_ids := array_append(v_job_ids, r_job.job_id);
    v_jobs_touched := v_jobs_touched + 1;

    -- Process each stage group (by stage_order) - FILTER OUT DTP/PROOF
    FOR r_stage_group IN
      SELECT 
        jsi.stage_order,
        array_agg(jsi.id ORDER BY jsi.id) as stage_instance_ids
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold')
        AND LOWER(ps.name) NOT LIKE '%dtp%'
        AND LOWER(ps.name) NOT LIKE '%proof%'
        AND LOWER(ps.name) NOT LIKE '%batch%allocation%'
      GROUP BY jsi.stage_order
      ORDER BY jsi.stage_order ASC
    LOOP
      RAISE NOTICE '[JOB: %] Stage order % has % instances', r_job.wo_no, r_stage_group.stage_order, array_length(r_stage_group.stage_instance_ids, 1);

      -- Process each stage instance in this group - FILTER OUT DTP/PROOF
      FOR r_stage IN
        SELECT 
          jsi.id as stage_instance_id,
          jsi.production_stage_id,
          jsi.stage_order,
          jsi.part_assignment,
          jsi.dependency_group,
          jsi.status,
          public.jsi_minutes(
            jsi.estimated_duration_minutes,
            jsi.actual_duration_minutes,
            jsi.manual_duration_override_minutes,
            jsi.status
          ) as duration_minutes,
          ps.name as stage_name,
          ps.capacity_per_slot
        FROM job_stage_instances jsi
        JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.id = ANY(r_stage_group.stage_instance_ids)
          AND LOWER(ps.name) NOT LIKE '%dtp%'
          AND LOWER(ps.name) NOT LIKE '%proof%'
          AND LOWER(ps.name) NOT LIKE '%batch%allocation%'
        ORDER BY jsi.id
      LOOP
        RAISE NOTICE '[STAGE: %] Starting placement for stage_instance_id=%', r_stage.stage_name, r_stage.stage_instance_id;

        v_next_avail := public.find_next_slot(
          r_stage.production_stage_id,
          v_base_start,
          r_stage.duration_minutes,
          v_slot_duration_minutes
        );

        v_current_stage_start := v_next_avail;
        v_stage_remaining_minutes := r_stage.duration_minutes;
        v_stage_placed_minutes := 0;

        WHILE v_stage_remaining_minutes > 0 LOOP
          DECLARE
            v_slot_start TIMESTAMPTZ;
            v_slot_end TIMESTAMPTZ;
            v_place_minutes INT;
          BEGIN
            SELECT slot_start, slot_end INTO v_slot_start, v_slot_end
            FROM public.shift_window_enhanced(v_current_stage_start, v_factory_tz);

            v_place_minutes := LEAST(v_stage_remaining_minutes, v_slot_duration_minutes);

            INSERT INTO stage_time_slots (
              production_stage_id,
              stage_instance_id,
              slot_start_time,
              slot_end_time,
              slot_duration_minutes,
              capacity_allocated,
              created_at
            ) VALUES (
              r_stage.production_stage_id,
              r_stage.stage_instance_id,
              v_slot_start,
              v_slot_start + (v_place_minutes || ' minutes')::INTERVAL,
              v_place_minutes,
              1,
              NOW()
            )
            ON CONFLICT (production_stage_id, slot_start_time)
            DO UPDATE SET
              capacity_allocated = stage_time_slots.capacity_allocated + 1,
              stage_instance_id = CASE
                WHEN stage_time_slots.capacity_allocated = 0 THEN EXCLUDED.stage_instance_id
                ELSE stage_time_slots.stage_instance_id
              END;

            v_slots_written := v_slots_written + 1;
            v_stage_placed_minutes := v_stage_placed_minutes + v_place_minutes;
            v_stage_remaining_minutes := v_stage_remaining_minutes - v_place_minutes;

            IF v_stage_remaining_minutes > 0 THEN
              v_current_stage_start := public.find_next_slot(
                r_stage.production_stage_id,
                v_slot_start + (v_place_minutes || ' minutes')::INTERVAL,
                v_stage_remaining_minutes,
                v_slot_duration_minutes
              );
            ELSE
              v_current_stage_end := v_slot_start + (v_place_minutes || ' minutes')::INTERVAL;
            END IF;
          END;
        END LOOP;

        UPDATE job_stage_instances
        SET scheduled_start_at = (
              SELECT MIN(slot_start_time)
              FROM stage_time_slots
              WHERE stage_instance_id = r_stage.stage_instance_id
            ),
            scheduled_end_at = (
              SELECT MAX(slot_end_time)
              FROM stage_time_slots
              WHERE stage_instance_id = r_stage.stage_instance_id
            ),
            scheduled_minutes = v_stage_placed_minutes,
            schedule_status = 'scheduled'
        WHERE id = r_stage.stage_instance_id;

        v_base_start := v_current_stage_end;

        RAISE NOTICE '[STAGE: %] Placed % minutes, ending at %', r_stage.stage_name, v_stage_placed_minutes, v_current_stage_end;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Gap-filling pass - FILTER OUT DTP/PROOF STAGES
  FOR gap_candidate IN
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.scheduled_start_at,
      jsi.scheduled_end_at,
      jsi.scheduled_minutes,
      jsi.stage_order,
      ps.name as stage_name,
      ps.allow_gap_filling
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.schedule_status = 'scheduled'
      AND ps.allow_gap_filling = true
      AND jsi.scheduled_minutes IS NOT NULL
      AND jsi.scheduled_minutes <= 120
      AND jsi.scheduled_start_at >= v_min_future_threshold
      AND LOWER(ps.name) NOT LIKE '%dtp%'
      AND LOWER(ps.name) NOT LIKE '%proof%'
      AND LOWER(ps.name) NOT LIKE '%batch%allocation%'
      AND (p_division IS NULL OR ps.division = p_division)
    ORDER BY jsi.stage_order ASC, jsi.scheduled_start_at DESC
    LIMIT 50
  LOOP
    RAISE NOTICE '[GAP-FILL] Considering stage_instance_id=% (% minutes)', gap_candidate.stage_instance_id, gap_candidate.scheduled_minutes;
  END LOOP;

  INSERT INTO batch_allocation_logs (operation, job_ids, slots_written, jobs_touched, created_at)
  VALUES ('reschedule_all', v_job_ids, v_slots_written, v_jobs_touched, NOW());

  RAISE NOTICE '[SCHEDULER_RESCHEDULE_ALL] Complete: slots_written=%, jobs_touched=%', v_slots_written, v_jobs_touched;

  RETURN jsonb_build_object(
    'success', true,
    'slots_written', v_slots_written,
    'jobs_touched', v_jobs_touched,
    'job_ids', v_job_ids
  );
END;
$$;

-- Recreate scheduler_append_jobs with DTP/PROOF filters
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids UUID[],
  p_only_if_unset BOOLEAN DEFAULT true,
  p_division TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_start TIMESTAMPTZ;
  v_current_time TIMESTAMPTZ;
  v_slots_written INT := 0;
  v_jobs_touched INT := 0;
  v_current_stage_start TIMESTAMPTZ;
  v_current_stage_end TIMESTAMPTZ;
  v_slot_duration_minutes INT := 60;
  v_next_avail TIMESTAMPTZ;
  v_stage_remaining_minutes INT;
  v_stage_placed_minutes INT;
  v_factory_tz TEXT := 'Africa/Johannesburg';
  r_job RECORD;
  r_stage_group RECORD;
  r_stage RECORD;
  gap_candidate RECORD;
BEGIN
  v_current_time := NOW() AT TIME ZONE v_factory_tz;
  v_base_start := v_current_time;

  RAISE NOTICE '[SCHEDULER_APPEND] Starting for % jobs with division=%', array_length(p_job_ids, 1), p_division;

  -- Main job loop - FILTER OUT DTP/PROOF STAGES
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.category_id,
      pj.division
    FROM production_jobs pj
    WHERE pj.id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NOT NULL
      AND (p_division IS NULL OR pj.division = p_division)
      AND EXISTS (
        SELECT 1 
        FROM job_stage_instances jsi2
        JOIN production_stages ps2 ON ps2.id = jsi2.production_stage_id
        WHERE jsi2.job_id = pj.id 
          AND jsi2.status IN ('pending', 'active', 'on_hold')
          AND LOWER(ps2.name) NOT LIKE '%dtp%'
          AND LOWER(ps2.name) NOT LIKE '%proof%'
          AND LOWER(ps2.name) NOT LIKE '%batch%allocation%'
      )
    ORDER BY pj.proof_approved_at ASC
  LOOP
    RAISE NOTICE '[JOB: %] Processing job_id=%', r_job.wo_no, r_job.job_id;
    v_jobs_touched := v_jobs_touched + 1;

    -- Process each stage group (by stage_order) - FILTER OUT DTP/PROOF
    FOR r_stage_group IN
      SELECT 
        jsi.stage_order,
        array_agg(jsi.id ORDER BY jsi.id) as stage_instance_ids
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold')
        AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
        AND LOWER(ps.name) NOT LIKE '%dtp%'
        AND LOWER(ps.name) NOT LIKE '%proof%'
        AND LOWER(ps.name) NOT LIKE '%batch%allocation%'
      GROUP BY jsi.stage_order
      ORDER BY jsi.stage_order ASC
    LOOP
      RAISE NOTICE '[JOB: %] Stage order % has % instances', r_job.wo_no, r_stage_group.stage_order, array_length(r_stage_group.stage_instance_ids, 1);

      -- Process each stage instance in this group - FILTER OUT DTP/PROOF
      FOR r_stage IN
        SELECT 
          jsi.id as stage_instance_id,
          jsi.production_stage_id,
          jsi.stage_order,
          jsi.part_assignment,
          jsi.status,
          public.jsi_minutes(
            jsi.estimated_duration_minutes,
            jsi.actual_duration_minutes,
            jsi.manual_duration_override_minutes,
            jsi.status
          ) as duration_minutes,
          ps.name as stage_name,
          ps.capacity_per_slot
        FROM job_stage_instances jsi
        JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.id = ANY(r_stage_group.stage_instance_ids)
          AND LOWER(ps.name) NOT LIKE '%dtp%'
          AND LOWER(ps.name) NOT LIKE '%proof%'
          AND LOWER(ps.name) NOT LIKE '%batch%allocation%'
        ORDER BY jsi.id
      LOOP
        RAISE NOTICE '[STAGE: %] Starting placement for stage_instance_id=%', r_stage.stage_name, r_stage.stage_instance_id;

        v_next_avail := public.find_next_slot(
          r_stage.production_stage_id,
          v_base_start,
          r_stage.duration_minutes,
          v_slot_duration_minutes
        );

        v_current_stage_start := v_next_avail;
        v_stage_remaining_minutes := r_stage.duration_minutes;
        v_stage_placed_minutes := 0;

        WHILE v_stage_remaining_minutes > 0 LOOP
          DECLARE
            v_slot_start TIMESTAMPTZ;
            v_slot_end TIMESTAMPTZ;
            v_place_minutes INT;
          BEGIN
            SELECT slot_start, slot_end INTO v_slot_start, v_slot_end
            FROM public.shift_window_enhanced(v_current_stage_start, v_factory_tz);

            v_place_minutes := LEAST(v_stage_remaining_minutes, v_slot_duration_minutes);

            INSERT INTO stage_time_slots (
              production_stage_id,
              stage_instance_id,
              slot_start_time,
              slot_end_time,
              slot_duration_minutes,
              capacity_allocated,
              created_at
            ) VALUES (
              r_stage.production_stage_id,
              r_stage.stage_instance_id,
              v_slot_start,
              v_slot_start + (v_place_minutes || ' minutes')::INTERVAL,
              v_place_minutes,
              1,
              NOW()
            )
            ON CONFLICT (production_stage_id, slot_start_time)
            DO UPDATE SET
              capacity_allocated = stage_time_slots.capacity_allocated + 1,
              stage_instance_id = CASE
                WHEN stage_time_slots.capacity_allocated = 0 THEN EXCLUDED.stage_instance_id
                ELSE stage_time_slots.stage_instance_id
              END;

            v_slots_written := v_slots_written + 1;
            v_stage_placed_minutes := v_stage_placed_minutes + v_place_minutes;
            v_stage_remaining_minutes := v_stage_remaining_minutes - v_place_minutes;

            IF v_stage_remaining_minutes > 0 THEN
              v_current_stage_start := public.find_next_slot(
                r_stage.production_stage_id,
                v_slot_start + (v_place_minutes || ' minutes')::INTERVAL,
                v_stage_remaining_minutes,
                v_slot_duration_minutes
              );
            ELSE
              v_current_stage_end := v_slot_start + (v_place_minutes || ' minutes')::INTERVAL;
            END IF;
          END;
        END LOOP;

        UPDATE job_stage_instances
        SET scheduled_start_at = (
              SELECT MIN(slot_start_time)
              FROM stage_time_slots
              WHERE stage_instance_id = r_stage.stage_instance_id
            ),
            scheduled_end_at = (
              SELECT MAX(slot_end_time)
              FROM stage_time_slots
              WHERE stage_instance_id = r_stage.stage_instance_id
            ),
            scheduled_minutes = v_stage_placed_minutes,
            schedule_status = 'scheduled'
        WHERE id = r_stage.stage_instance_id;

        v_base_start := v_current_stage_end;

        RAISE NOTICE '[STAGE: %] Placed % minutes, ending at %', r_stage.stage_name, v_stage_placed_minutes, v_current_stage_end;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Gap-filling pass - FILTER OUT DTP/PROOF STAGES
  FOR gap_candidate IN
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.scheduled_start_at,
      jsi.scheduled_end_at,
      jsi.scheduled_minutes,
      jsi.stage_order,
      ps.name as stage_name,
      ps.allow_gap_filling,
      pj.wo_no,
      COALESCE(
        (SELECT MAX(jsi2.scheduled_end_at)
         FROM job_stage_instances jsi2
         WHERE jsi2.job_id = jsi.job_id
           AND jsi2.stage_order < jsi.stage_order
           AND jsi2.scheduled_end_at IS NOT NULL),
        pj.proof_approved_at
      ) as earliest_possible_start
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.job_id = ANY(p_job_ids)
      AND jsi.schedule_status = 'scheduled'
      AND ps.allow_gap_filling = true
      AND jsi.scheduled_minutes IS NOT NULL
      AND jsi.scheduled_minutes <= 120
      AND jsi.scheduled_start_at IS NOT NULL
      AND LOWER(ps.name) NOT LIKE '%dtp%'
      AND LOWER(ps.name) NOT LIKE '%proof%'
      AND LOWER(ps.name) NOT LIKE '%batch%allocation%'
      AND (p_division IS NULL OR pj.division = p_division)
    ORDER BY jsi.job_id, jsi.stage_order ASC, jsi.scheduled_start_at ASC
    LIMIT 20
  LOOP
    RAISE NOTICE '[GAP-FILL] Considering stage_instance_id=% (% minutes)', gap_candidate.stage_instance_id, gap_candidate.scheduled_minutes;
  END LOOP;

  INSERT INTO batch_allocation_logs (operation, job_ids, slots_written, jobs_touched, created_at)
  VALUES ('append_jobs', p_job_ids, v_slots_written, v_jobs_touched, NOW());

  RAISE NOTICE '[SCHEDULER_APPEND] Complete: slots_written=%, jobs_touched=%', v_slots_written, v_jobs_touched;

  RETURN jsonb_build_object(
    'success', true,
    'slots_written', v_slots_written,
    'jobs_touched', v_jobs_touched
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.scheduler_reschedule_all_by_division(TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scheduler_append_jobs(UUID[], BOOLEAN, TEXT) TO authenticated;