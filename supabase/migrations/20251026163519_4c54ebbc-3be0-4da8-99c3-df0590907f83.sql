-- Drop existing function
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(text);

-- Recreate with corrected column names and safe operations
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_division text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleared_slots integer := 0;
  v_cleared_jsi integer := 0;
  v_wrote_slots integer := 0;
  v_updated_jsi integer := 0;
BEGIN
  -- Step 1: Division-scoped DELETE from stage_time_slots with WHERE clause
  DELETE FROM public.stage_time_slots sts
  USING public.production_jobs pj
  WHERE sts.job_table_name = 'production_jobs'
    AND sts.job_id = pj.id
    AND COALESCE(sts.is_completed, false) = false
    AND (p_division IS NULL OR pj.division = p_division);
  
  GET DIAGNOSTICS v_cleared_slots = ROW_COUNT;

  -- Step 2: Division-scoped UPDATE to reset job_stage_instances schedule fields
  UPDATE public.job_stage_instances jsi
  SET scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = 0,
      schedule_status = 'unscheduled',
      queue_position = NULL
  FROM public.production_jobs pj
  WHERE jsi.job_table_name = 'production_jobs'
    AND jsi.job_id = pj.id
    AND (p_division IS NULL OR pj.division = p_division);
  
  GET DIAGNOSTICS v_cleared_jsi = ROW_COUNT;

  -- Step 3: Build schedulable_stages CTE with correct column names
  WITH schedulable_stages AS (
    SELECT
      jsi.id AS stage_instance_id,
      jsi.job_id,
      jsi.job_table_name,
      jsi.production_stage_id,
      jsi.estimated_duration_minutes,
      jsi.stage_order,
      jsi.schedule_status,
      jsi.scheduled_start_at,
      pj.due_date,
      pj.proof_approved_at,
      pj.created_at,
      pj.division,
      ps.name AS stage_name,
      COALESCE(ps.stage_group_id, gen_random_uuid()) AS dependency_group
    FROM public.job_stage_instances jsi
    JOIN public.production_jobs pj ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
    JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
    WHERE (p_division IS NULL OR pj.division = p_division)
      AND LOWER(ps.name) NOT LIKE '%proof%'
      AND NOT EXISTS (
        SELECT 1 FROM public.stage_groups sg
        WHERE sg.id = ps.stage_group_id AND LOWER(sg.name) = 'dtp'
      )
      AND (jsi.scheduled_start_at IS NULL 
           OR jsi.schedule_status IS NULL 
           OR jsi.schedule_status NOT IN ('completed'))
  ),
  ranked_stages AS (
    SELECT
      ss.*,
      ROW_NUMBER() OVER (
        PARTITION BY ss.production_stage_id, ss.dependency_group
        ORDER BY ss.due_date ASC NULLS LAST,
                 COALESCE(ss.proof_approved_at, ss.created_at) ASC NULLS LAST
      ) AS fifo_rank
    FROM schedulable_stages ss
  ),
  slot_inserts AS (
    INSERT INTO public.stage_time_slots (
      production_stage_id,
      stage_instance_id,
      job_id,
      job_table_name,
      slot_start_time,
      slot_end_time,
      duration_minutes
    )
    SELECT
      rs.production_stage_id,
      rs.stage_instance_id,
      rs.job_id,
      rs.job_table_name,
      NOW() + (rs.fifo_rank || ' hours')::interval AS slot_start_time,
      NOW() + (rs.fifo_rank || ' hours')::interval + (COALESCE(rs.estimated_duration_minutes, 60) || ' minutes')::interval AS slot_end_time,
      COALESCE(rs.estimated_duration_minutes, 60)
    FROM ranked_stages rs
    ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_wrote_slots FROM slot_inserts;

  -- Step 4: Update job_stage_instances with scheduled times
  UPDATE public.job_stage_instances jsi
  SET scheduled_start_at = sts.slot_start_time,
      scheduled_end_at = sts.slot_end_time,
      scheduled_minutes = sts.duration_minutes,
      schedule_status = 'scheduled'
  FROM public.stage_time_slots sts
  WHERE jsi.id = sts.stage_instance_id
    AND jsi.scheduled_start_at IS NULL;
  
  GET DIAGNOSTICS v_updated_jsi = ROW_COUNT;

  -- Return JSON summary
  RETURN jsonb_build_object(
    'cleared_slots', v_cleared_slots,
    'cleared_jsi', v_cleared_jsi,
    'wrote_slots', v_wrote_slots,
    'updated_jsi', v_updated_jsi
  );
END;
$$;