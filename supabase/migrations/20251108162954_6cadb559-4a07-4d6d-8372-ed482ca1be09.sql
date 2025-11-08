-- ============================================================
-- FIX: Add 'Ready to Print' and 'pending' statuses to Phase 1 filter
-- ============================================================
-- Changes line 44 only: j.status IN ('Approved', 'In Production', 'Ready to Print', 'pending')
-- This allows Phase 1 to schedule all jobs, then Phase 2 gap-filling optimizes
-- ============================================================

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
    p_wipe_all boolean DEFAULT false,
    p_start_from timestamp with time zone DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_base_start timestamptz;
  v_slots_written int := 0;
  v_jsi_updated int := 0;
  v_violations jsonb := '[]'::jsonb;
  v_days_saved numeric := 0;
BEGIN
  -- Clear existing schedule
  IF p_wipe_all THEN
    DELETE FROM stage_time_slots;
    UPDATE job_stage_instances
    SET scheduled_start = NULL, scheduled_end = NULL
    WHERE status IN ('scheduled','proposed');
  END IF;

  v_base_start := COALESCE(p_start_from, (now() AT TIME ZONE 'Africa/Johannesburg')::date + interval '1 day' + interval '8 hours');

  PERFORM create_stage_availability_tracker();

  WITH RECURSIVE
    barrier_agg AS (
      SELECT
        pb.follower_stage_id,
        array_agg(pb.predecessor_stage_id) AS preds
      FROM production_barriers pb
      GROUP BY pb.follower_stage_id
    ),
    first_stage AS (
      SELECT
        jsi.id AS stage_id,
        jsi.job_id,
        ps.name AS stage_name,
        jsi.part_assignment,
        jsi.status,
        ps.requires_kit_check,
        ps.estimated_minutes,
        j.proof_approved_at,
        j.due_date,
        ARRAY[]::uuid[] AS path
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.stage_id
      JOIN production_jobs j ON j.id = jsi.job_id
      WHERE jsi.status IN ('scheduled','proposed')
        AND j.status IN ('Approved', 'In Production', 'Ready to Print', 'pending')
        AND NOT EXISTS (
          SELECT 1 FROM production_barriers pb
          WHERE pb.follower_stage_id = jsi.stage_id
        )
    ),
    stage_schedule AS (
      SELECT * FROM first_stage
      UNION ALL
      SELECT
        jsi.id,
        jsi.job_id,
        ps.name,
        jsi.part_assignment,
        jsi.status,
        ps.requires_kit_check,
        ps.estimated_minutes,
        prev.proof_approved_at,
        prev.due_date,
        prev.path || prev.stage_id
      FROM stage_schedule prev
      JOIN production_barriers pb ON pb.predecessor_stage_id = prev.stage_id
      JOIN job_stage_instances jsi ON jsi.stage_id = pb.follower_stage_id AND jsi.job_id = prev.job_id
      JOIN production_stages ps ON ps.id = jsi.stage_id
      WHERE jsi.status IN ('scheduled','proposed')
        AND NOT (prev.stage_id = ANY(prev.path))
    ),
    updated_stages AS (
      INSERT INTO stage_time_slots (job_stage_instance_id, start_time, end_time, part_assignment)
      SELECT
        ss.stage_id,
        COALESCE(st.next_available_time, v_base_start),
        COALESCE(st.next_available_time, v_base_start) + (ss.estimated_minutes || ' minutes')::interval,
        ss.part_assignment
      FROM stage_schedule ss
      LEFT JOIN _stage_tails st ON st.stage_id = ss.stage_id
      ORDER BY ss.proof_approved_at NULLS LAST, array_length(ss.path,1) NULLS FIRST
      ON CONFLICT (job_stage_instance_id, part_assignment) DO UPDATE
        SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time
      RETURNING job_stage_instance_id, start_time, end_time
    )
    UPDATE job_stage_instances jsi
    SET
      scheduled_start = us.start_time,
      scheduled_end = us.end_time
    FROM updated_stages us
    WHERE jsi.id = us.job_stage_instance_id;

  GET DIAGNOSTICS v_jsi_updated = ROW_COUNT;
  SELECT COUNT(*) INTO v_slots_written FROM stage_time_slots;

  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'job_id', v.job_id,
        'violation', v.violation_type,
        'stage', v.stage_name,
        'saved_time_minutes', v.time_saved_minutes
      )
    ), '[]'::jsonb),
    COALESCE(SUM(v.time_saved_minutes) / 480.0, 0)
  INTO v_violations, v_days_saved
  FROM validate_job_scheduling_precedence() v;

  RETURN jsonb_build_object(
    'success', true,
    'slots_written', v_slots_written,
    'jsi_updated', v_jsi_updated,
    'violations', v_violations,
    'days_saved', v_days_saved
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

ALTER FUNCTION public.scheduler_reschedule_all_parallel_aware(boolean, timestamptz) OWNER TO postgres;