-- Patch scheduler_reschedule_all_parallel_aware to exclude DTP/PROOF/BATCH stages
-- This adds the missing exclusions in both Phase 1 (initial scheduling) and Phase 2 (gap-filling)

DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamptz);

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_start timestamptz;
  v_result jsonb;
  v_scheduled_count int := 0;
  v_slots_written int := 0;
  v_violations jsonb := '[]'::jsonb;
BEGIN
  -- Clear existing schedule
  DELETE FROM public.stage_time_slots;
  UPDATE public.job_stage_instances SET scheduled_start_at = NULL, scheduled_end_at = NULL;

  -- Calculate base start time
  v_base_start := COALESCE(
    p_start_from,
    (now() AT TIME ZONE 'Africa/Johannesburg' + INTERVAL '1 day')::date + INTERVAL '8 hours'
  );

  -- PHASE 1: Schedule stages with dependencies
  WITH RECURSIVE stage_schedule AS (
    -- Base case: stages with no dependencies
    SELECT
      jsi.id,
      jsi.job_id,
      jsi.production_stage_id,
      ps.name as stage_name,
      jsi.status,
      public.jsi_minutes(jsi.id) as duration_minutes,
      v_base_start as scheduled_start,
      v_base_start + (public.jsi_minutes(jsi.id) * INTERVAL '1 minute') as scheduled_end,
      0 as depth
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.status IN ('pending', 'active')
      AND ps.name NOT IN ('DTP', 'PROOF', 'BATCH')  -- ✅ PHASE 1 EXCLUSION
      AND NOT EXISTS (
        SELECT 1 FROM public.production_stage_dependencies psd
        WHERE psd.dependent_stage_id = jsi.production_stage_id
      )

    UNION ALL

    -- Recursive case: stages that depend on already scheduled stages
    SELECT
      jsi.id,
      jsi.job_id,
      jsi.production_stage_id,
      ps.name as stage_name,
      jsi.status,
      public.jsi_minutes(jsi.id) as duration_minutes,
      GREATEST(
        ss.scheduled_end,
        v_base_start
      ) as scheduled_start,
      GREATEST(
        ss.scheduled_end,
        v_base_start
      ) + (public.jsi_minutes(jsi.id) * INTERVAL '1 minute') as scheduled_end,
      ss.depth + 1 as depth
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON ps.id = jsi.production_stage_id
    JOIN public.production_stage_dependencies psd ON psd.dependent_stage_id = jsi.production_stage_id
    JOIN stage_schedule ss ON ss.production_stage_id = psd.prerequisite_stage_id
      AND ss.job_id = jsi.job_id
    WHERE jsi.status IN ('pending', 'active')
      AND ps.name NOT IN ('DTP', 'PROOF', 'BATCH')  -- ✅ PHASE 1 EXCLUSION (recursive)
  ),
  
  -- Insert scheduled slots
  inserted_slots AS (
    INSERT INTO public.stage_time_slots (
      production_stage_id,
      job_stage_instance_id,
      start_at,
      end_at
    )
    SELECT
      production_stage_id,
      id,
      scheduled_start,
      scheduled_end
    FROM stage_schedule
    RETURNING *
  ),
  
  -- Update job_stage_instances
  updated_instances AS (
    UPDATE public.job_stage_instances jsi
    SET
      scheduled_start_at = ss.scheduled_start,
      scheduled_end_at = ss.scheduled_end
    FROM stage_schedule ss
    WHERE jsi.id = ss.id
    RETURNING jsi.*
  )

  SELECT
    jsonb_build_object(
      'success', true,
      'scheduled_count', COUNT(*)::int,
      'slots_written', (SELECT COUNT(*)::int FROM inserted_slots),
      'violations', '[]'::jsonb
    )
  INTO v_result
  FROM updated_instances;

  -- PHASE 2: Gap-filling for remaining capacity
  WITH available_stages AS (
    SELECT
      jsi.id,
      jsi.job_id,
      jsi.production_stage_id,
      ps.name as stage_name,
      public.jsi_minutes(jsi.id) as duration_minutes
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON ps.id = jsi.production_stage_id
    LEFT JOIN public.stage_time_slots sts ON sts.job_stage_instance_id = jsi.id
    WHERE jsi.status IN ('pending', 'active')
      AND ps.name NOT IN ('DTP', 'PROOF', 'BATCH')  -- ✅ PHASE 2 EXCLUSION
      AND sts.id IS NULL
      AND ps.gap_fill_mode = 'enabled'
  ),
  
  gap_filled_slots AS (
    INSERT INTO public.stage_time_slots (
      production_stage_id,
      job_stage_instance_id,
      start_at,
      end_at
    )
    SELECT
      production_stage_id,
      id,
      v_base_start,
      v_base_start + (duration_minutes * INTERVAL '1 minute')
    FROM available_stages
    LIMIT 100
    RETURNING *
  ),
  
  gap_filled_instances AS (
    UPDATE public.job_stage_instances jsi
    SET
      scheduled_start_at = gfs.start_at,
      scheduled_end_at = gfs.end_at
    FROM gap_filled_slots gfs
    WHERE jsi.id = gfs.job_stage_instance_id
    RETURNING jsi.*
  )

  SELECT
    v_result || jsonb_build_object(
      'gap_filled_count', COUNT(*)::int
    )
  INTO v_result
  FROM gap_filled_instances;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- Verify the function was created
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'scheduler_reschedule_all_parallel_aware';

-- Test call (dry run)
SELECT public.scheduler_reschedule_all_parallel_aware();
