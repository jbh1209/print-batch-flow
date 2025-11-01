-- Drop and recreate scheduler_reschedule_all_parallel_aware without invalid department_id column
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(text);

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(p_division text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_start timestamptz;
  v_pre_cleanup_count int;
  v_cleared_count int;
  v_wrote_slots int := 0;
  v_updated_jsi int := 0;
BEGIN
  -- 1) Pre-cleanup count (how many slots exist before we clear)
  SELECT COUNT(*)
  INTO v_pre_cleanup_count
  FROM public.stage_time_slots;
  
  RAISE NOTICE 'Pre-cleanup: % slots exist', v_pre_cleanup_count;

  -- 2) Clear all existing slots
  DELETE FROM public.stage_time_slots;
  
  GET DIAGNOSTICS v_cleared_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % slots', v_cleared_count;

  -- 3) Base start time
  v_base_start := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg' + interval '1 day')::date + time '08:00:00';

  -- 4) approved_jobs CTE: fetch jobs with proof approved
  WITH approved_jobs AS (
    SELECT
      pj.id,
      pj.job_number,
      pj.division,
      pj.due_date,
      pj.proof_approved_at,
      pj.created_at
    FROM public.production_jobs pj
    WHERE pj.status NOT IN ('cancelled', 'completed', 'archived')
      AND pj.proof_approved_at IS NOT NULL
      AND (p_division IS NULL OR pj.division = p_division)
  ),

  -- 5) schedulable_stages CTE
  schedulable_stages AS (
    SELECT
      jsi.id AS stage_instance_id,
      jsi.production_job_id,
      jsi.production_stage_id,
      jsi.scheduled_minutes,
      aj.job_number,
      aj.due_date,
      aj.proof_approved_at,
      aj.created_at,
      ps.stage_name,
      ps.stage_code,
      ps.parallel_group
    FROM public.job_stage_instances jsi
    INNER JOIN approved_jobs aj ON aj.id = jsi.production_job_id
    INNER JOIN public.production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.stage_status IN ('pending', 'scheduled', 'active')
      AND jsi.scheduled_minutes > 0
      AND ps.stage_code NOT IN ('DTP', 'PROOF', 'BATCH_ALLOCATION')
  ),

  -- 6) ranked_stages CTE: rank by due_date + proof_approved_at (FIFO)
  ranked_stages AS (
    SELECT
      ss.*,
      ROW_NUMBER() OVER (
        ORDER BY ss.due_date ASC NULLS LAST,
                 COALESCE(ss.proof_approved_at, ss.created_at) ASC NULLS LAST
      ) AS rn
    FROM schedulable_stages ss
  ),

  -- 7) Build slots with parallel grouping
  built_slots AS (
    SELECT
      gen_random_uuid() AS id,
      rs.stage_instance_id,
      rs.production_stage_id,
      v_base_start + (
        CASE
          WHEN rs.parallel_group IS NOT NULL THEN
            (SELECT COALESCE(MAX(offset_hours), 0)
             FROM ranked_stages r2
             WHERE r2.rn < rs.rn
               AND (r2.parallel_group IS NULL OR r2.parallel_group != rs.parallel_group)
            ) * interval '1 hour'
          ELSE
            (SELECT COALESCE(SUM(scheduled_minutes), 0)
             FROM ranked_stages r2
             WHERE r2.rn < rs.rn
            ) * interval '1 minute'
        END
      ) AS slot_start_time,
      rs.scheduled_minutes AS slot_minutes
    FROM ranked_stages rs
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN rs.parallel_group IS NOT NULL THEN
            (SELECT COALESCE(MAX(r3.scheduled_minutes), rs.scheduled_minutes) / 60.0
             FROM ranked_stages r3
             WHERE r3.rn <= rs.rn AND r3.parallel_group = rs.parallel_group
            )
          ELSE 0
        END AS offset_hours
    ) AS parallel_calc
  )

  -- 8) Insert slots
  INSERT INTO public.stage_time_slots (id, stage_instance_id, production_stage_id, slot_start_time, slot_minutes)
  SELECT id, stage_instance_id, production_stage_id, slot_start_time, slot_minutes
  FROM built_slots;

  GET DIAGNOSTICS v_wrote_slots = ROW_COUNT;

  -- 9) Update job_stage_instances with scheduled times
  WITH updated_instances AS (
    UPDATE public.job_stage_instances jsi
    SET
      scheduled_start_at = sts.slot_start_time,
      scheduled_end_at = sts.slot_start_time + (sts.slot_minutes * interval '1 minute'),
      scheduled_minutes = sts.slot_minutes,
      schedule_status = 'scheduled'
    FROM public.stage_time_slots sts
    WHERE sts.stage_instance_id = jsi.id
    RETURNING jsi.id
  )
  SELECT COUNT(*) INTO v_updated_jsi FROM updated_instances;

  RAISE NOTICE 'Scheduler complete: wrote_slots=%, updated_jsi=%', v_wrote_slots, v_updated_jsi;

  RETURN jsonb_build_object(
    'success', true,
    'wrote_slots', v_wrote_slots,
    'updated_jsi', v_updated_jsi,
    'pre_cleanup_count', v_pre_cleanup_count,
    'cleared_count', v_cleared_count
  );
END;
$$;