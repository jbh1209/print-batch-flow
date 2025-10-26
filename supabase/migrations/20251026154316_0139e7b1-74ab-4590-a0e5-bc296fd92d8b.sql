-- Fix SQL scoping error in scheduler_reschedule_all_parallel_aware
-- Replace LEFT JOIN with correlated subquery to avoid 42P01 error

DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(text);

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(p_division text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_dtp_proof_slots integer := 0;
  v_cleared_stages integer := 0;
  v_cleared_slots integer := 0;
  v_wrote_slots integer := 0;
  v_updated_jsi integer := 0;
  v_result jsonb;
BEGIN
  -- 1) Pre-cleanup: Delete DTP/Proof slots (division-scoped)
  WITH deleted_slots AS (
    DELETE FROM stage_time_slots sts
    USING production_stages ps, production_jobs pj
    WHERE sts.production_stage_id = ps.id
      AND sts.job_id = pj.id
      AND sts.job_table_name = 'production_jobs'
      AND COALESCE(sts.is_completed, false) = false
      AND (
        LOWER(COALESCE((SELECT sg.name
                         FROM stage_groups sg
                         WHERE sg.id = ps.stage_group_id), '')) = 'dtp'
        OR LOWER(ps.name) LIKE '%proof%'
      )
      AND (p_division IS NULL OR pj.division = p_division)
    RETURNING sts.id
  )
  SELECT COUNT(*) INTO v_deleted_dtp_proof_slots FROM deleted_slots;

  RAISE NOTICE 'Pre-cleanup deleted % DTP/Proof slots for division=%', v_deleted_dtp_proof_slots, COALESCE(p_division, 'ALL');

  -- 2) Clear pending stages (division-scoped)
  WITH cleared AS (
    UPDATE job_stage_instances jsi
    SET scheduled_start_at = NULL,
        scheduled_end_at = NULL,
        scheduled_minutes = 0,
        queue_position = NULL,
        schedule_status = 'unscheduled'
    FROM production_jobs pj
    WHERE jsi.job_id = pj.id
      AND jsi.job_table_name = 'production_jobs'
      AND jsi.status IN ('pending', 'ready')
      AND (p_division IS NULL OR pj.division = p_division)
    RETURNING jsi.id
  )
  SELECT COUNT(*) INTO v_cleared_stages FROM cleared;

  -- 3) Clear non-completed time slots (division-scoped)
  WITH cleared_slots AS (
    DELETE FROM stage_time_slots sts
    USING production_jobs pj
    WHERE sts.job_id = pj.id
      AND sts.job_table_name = 'production_jobs'
      AND COALESCE(sts.is_completed, false) = false
      AND (p_division IS NULL OR pj.division = p_division)
    RETURNING sts.id
  )
  SELECT COUNT(*) INTO v_cleared_slots FROM cleared_slots;

  RAISE NOTICE 'Cleared % stages, % time slots for division=%', v_cleared_stages, v_cleared_slots, COALESCE(p_division, 'ALL');

  -- 4) Rebuild schedule
  WITH approved_jobs AS (
    SELECT
      pj.id AS job_id,
      'production_jobs' AS job_table_name,
      pj.due_date,
      pj.priority,
      pj.created_at
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
      AND pj.status NOT IN ('completed', 'cancelled')
      AND (p_division IS NULL OR pj.division = p_division)
  ),
  schedulable_stages AS (
    SELECT
      jsi.id AS stage_instance_id,
      jsi.job_id,
      jsi.job_table_name,
      jsi.production_stage_id,
      jsi.estimated_duration_minutes,
      jsi.status,
      jsi.stage_order,
      ps.name AS stage_name,
      ps.department_id,
      COALESCE(ps.stage_group_id, gen_random_uuid()) AS dependency_group,
      aj.due_date,
      aj.priority,
      aj.created_at
    FROM job_stage_instances jsi
    JOIN approved_jobs aj ON jsi.job_id = aj.job_id AND jsi.job_table_name = aj.job_table_name
    JOIN production_stages ps ON jsi.production_stage_id = ps.id
    WHERE jsi.status IN ('pending', 'ready')
      AND jsi.scheduled_start_at IS NULL
      AND LOWER(ps.name) NOT LIKE '%proof%'
      AND NOT EXISTS (
        SELECT 1 FROM stage_groups sg
        WHERE sg.id = ps.stage_group_id AND LOWER(sg.name) = 'dtp'
      )
  ),
  ranked_stages AS (
    SELECT
      ss.*,
      ROW_NUMBER() OVER (
        PARTITION BY ss.production_stage_id, ss.dependency_group
        ORDER BY
          ss.due_date ASC NULLS LAST,
          ss.priority DESC NULLS LAST,
          ss.created_at ASC
      ) AS fifo_rank
    FROM schedulable_stages ss
  ),
  inserted_slots AS (
    INSERT INTO stage_time_slots (
      production_stage_id,
      stage_instance_id,
      job_id,
      job_table_name,
      slot_start_time,
      slot_end_time,
      is_completed
    )
    SELECT
      rs.production_stage_id,
      rs.stage_instance_id,
      rs.job_id,
      rs.job_table_name,
      now() + (rs.fifo_rank || ' hours')::interval AS slot_start_time,
      now() + (rs.fifo_rank || ' hours')::interval + (COALESCE(rs.estimated_duration_minutes, 60) || ' minutes')::interval AS slot_end_time,
      false
    FROM ranked_stages rs
    ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING
    RETURNING id
  ),
  updated_stages AS (
    UPDATE job_stage_instances jsi
    SET
      scheduled_start_at = sts.slot_start_time,
      scheduled_end_at = sts.slot_end_time,
      scheduled_minutes = EXTRACT(EPOCH FROM (sts.slot_end_time - sts.slot_start_time)) / 60,
      schedule_status = 'scheduled'
    FROM stage_time_slots sts
    WHERE jsi.id = sts.stage_instance_id
      AND sts.id IN (SELECT id FROM inserted_slots)
    RETURNING jsi.id
  )
  SELECT
    (SELECT COUNT(*) FROM inserted_slots) AS wrote_slots,
    (SELECT COUNT(*) FROM updated_stages) AS updated_jsi
  INTO v_wrote_slots, v_updated_jsi;

  RAISE NOTICE 'Scheduler complete: wrote_slots=%, updated_jsi=%, division=%', v_wrote_slots, v_updated_jsi, COALESCE(p_division, 'ALL');

  v_result := jsonb_build_object(
    'wrote_slots', v_wrote_slots,
    'updated_jsi', v_updated_jsi,
    'cleared_stages', v_cleared_stages,
    'cleared_slots', v_cleared_slots,
    'deleted_dtp_proof_slots', v_deleted_dtp_proof_slots,
    'division', COALESCE(p_division, 'ALL'),
    'violations', '[]'::jsonb
  );

  RETURN v_result;
END;
$$;