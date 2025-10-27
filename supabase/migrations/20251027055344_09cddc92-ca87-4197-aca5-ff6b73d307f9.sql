-- Drop existing functions first to allow return type changes
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_by_division(TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(UUID[], TEXT, TIMESTAMPTZ);

-- Fix jsi_minutes signature in scheduler_reschedule_all_by_division
CREATE FUNCTION public.scheduler_reschedule_all_by_division(
  p_division TEXT,
  p_start_from TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  wrote_slots INT,
  updated_jsi INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wrote_slots INT := 0;
  v_updated_jsi INT := 0;
BEGIN
  -- Delete existing slots for this division
  DELETE FROM public.stage_time_slots
  WHERE production_stage_id IN (
    SELECT id FROM public.production_stages WHERE division = p_division
  );

  -- Build schedule for all active jobs in this division
  WITH active_jobs AS (
    SELECT DISTINCT
      jsi.id,
      jsi.job_id,
      jsi.job_table_name,
      jsi.production_stage_id,
      jsi.stage_order,
      jsi.division,
      public.jsi_minutes(
        jsi.scheduled_minutes,
        jsi.estimated_duration_minutes,
        jsi.remaining_minutes,
        jsi.completion_percentage
      ) as duration_minutes,
      jsi.part_name,
      COALESCE(pj.due_date, pj.created_at + interval '3 days') as job_due_date
    FROM public.job_stage_instances jsi
    LEFT JOIN public.production_jobs pj ON pj.id = jsi.job_id AND jsi.job_table_name = 'production_jobs'
    WHERE jsi.division = p_division
      AND jsi.status IN ('pending', 'in_progress', 'held')
      AND jsi.production_stage_id NOT IN (
        SELECT id FROM public.production_stages WHERE name IN ('DTP', 'PROOF')
      )
    ORDER BY jsi.stage_order, job_due_date, jsi.job_id
  ),
  new_slots AS (
    SELECT
      gen_random_uuid() as id,
      aj.id as stage_instance_id,
      aj.production_stage_id,
      COALESCE(p_start_from, now()) + (ROW_NUMBER() OVER (PARTITION BY aj.production_stage_id ORDER BY aj.stage_order, aj.job_due_date) - 1) * interval '1 hour' as slot_start_time,
      COALESCE(p_start_from, now()) + ROW_NUMBER() OVER (PARTITION BY aj.production_stage_id ORDER BY aj.stage_order, aj.job_due_date) * interval '1 hour' as slot_end_time,
      aj.duration_minutes,
      now() as created_at,
      now() as updated_at
    FROM active_jobs aj
  )
  INSERT INTO public.stage_time_slots (
    id, stage_instance_id, production_stage_id, slot_start_time, slot_end_time, duration_minutes, created_at, updated_at
  )
  SELECT id, stage_instance_id, production_stage_id, slot_start_time, slot_end_time, duration_minutes, created_at, updated_at
  FROM new_slots;

  GET DIAGNOSTICS v_wrote_slots = ROW_COUNT;

  -- Update job_stage_instances with scheduled times
  UPDATE public.job_stage_instances jsi
  SET
    scheduled_start_at = sts.slot_start_time,
    scheduled_end_at = sts.slot_end_time,
    schedule_status = 'scheduled',
    updated_at = now()
  FROM public.stage_time_slots sts
  WHERE sts.stage_instance_id = jsi.id
    AND jsi.division = p_division;

  GET DIAGNOSTICS v_updated_jsi = ROW_COUNT;

  RETURN QUERY SELECT v_wrote_slots, v_updated_jsi;
END;
$$;

-- Fix jsi_minutes signature in scheduler_append_jobs
CREATE FUNCTION public.scheduler_append_jobs(
  p_job_ids UUID[],
  p_division TEXT DEFAULT 'DIG',
  p_start_from TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  wrote_slots INT,
  updated_jsi INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wrote_slots INT := 0;
  v_updated_jsi INT := 0;
BEGIN
  -- Build schedule for specified jobs
  WITH target_jobs AS (
    SELECT DISTINCT
      jsi.id,
      jsi.job_id,
      jsi.job_table_name,
      jsi.production_stage_id,
      jsi.stage_order,
      jsi.division,
      public.jsi_minutes(
        jsi.scheduled_minutes,
        jsi.estimated_duration_minutes,
        jsi.remaining_minutes,
        jsi.completion_percentage
      ) as duration_minutes,
      jsi.part_name,
      COALESCE(pj.due_date, pj.created_at + interval '3 days') as job_due_date
    FROM public.job_stage_instances jsi
    LEFT JOIN public.production_jobs pj ON pj.id = jsi.job_id AND jsi.job_table_name = 'production_jobs'
    WHERE jsi.job_id = ANY(p_job_ids)
      AND jsi.division = p_division
      AND jsi.status IN ('pending', 'in_progress', 'held')
      AND jsi.production_stage_id NOT IN (
        SELECT id FROM public.production_stages WHERE name IN ('DTP', 'PROOF')
      )
    ORDER BY jsi.stage_order, job_due_date, jsi.job_id
  ),
  new_slots AS (
    SELECT
      gen_random_uuid() as id,
      tj.id as stage_instance_id,
      tj.production_stage_id,
      COALESCE(p_start_from, now()) + (ROW_NUMBER() OVER (PARTITION BY tj.production_stage_id ORDER BY tj.stage_order, tj.job_due_date) - 1) * interval '1 hour' as slot_start_time,
      COALESCE(p_start_from, now()) + ROW_NUMBER() OVER (PARTITION BY tj.production_stage_id ORDER BY tj.stage_order, tj.job_due_date) * interval '1 hour' as slot_end_time,
      tj.duration_minutes,
      now() as created_at,
      now() as updated_at
    FROM target_jobs tj
  )
  INSERT INTO public.stage_time_slots (
    id, stage_instance_id, production_stage_id, slot_start_time, slot_end_time, duration_minutes, created_at, updated_at
  )
  SELECT id, stage_instance_id, production_stage_id, slot_start_time, slot_end_time, duration_minutes, created_at, updated_at
  FROM new_slots;

  GET DIAGNOSTICS v_wrote_slots = ROW_COUNT;

  -- Update job_stage_instances with scheduled times
  UPDATE public.job_stage_instances jsi
  SET
    scheduled_start_at = sts.slot_start_time,
    scheduled_end_at = sts.slot_end_time,
    schedule_status = 'scheduled',
    updated_at = now()
  FROM public.stage_time_slots sts
  WHERE sts.stage_instance_id = jsi.id
    AND jsi.job_id = ANY(p_job_ids);

  GET DIAGNOSTICS v_updated_jsi = ROW_COUNT;

  RETURN QUERY SELECT v_wrote_slots, v_updated_jsi;
END;
$$;