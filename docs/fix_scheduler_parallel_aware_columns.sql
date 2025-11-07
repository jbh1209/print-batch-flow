-- ============================================================
-- FIX: Correct column references in scheduler_reschedule_all_parallel_aware
-- ============================================================
-- Problem: Function references non-existent columns (stage_name, machine_type, stage_status)
-- Solution: JOIN with production_stages for ps.name, use jsi.status instead of jsi.stage_status
-- ============================================================

-- Drop existing overloaded functions to prevent ambiguity
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamp with time zone, boolean) CASCADE;

-- Recreate with correct column references
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_start_from timestamptz DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_base_start timestamptz;
  v_scheduled_count int := 0;
  v_wrote_slots int := 0;
  v_violations jsonb := '[]'::jsonb;
BEGIN
  RAISE NOTICE '🔧 scheduler_reschedule_all_parallel_aware called with start_from=%', p_start_from;

  -- Clear existing schedule data
  DELETE FROM public.stage_time_slots;
  DELETE FROM public.job_stage_instances WHERE status = 'scheduled';

  -- Calculate base start time
  IF p_start_from IS NULL THEN
    v_base_start := (CURRENT_DATE + interval '1 day' + interval '8 hours') AT TIME ZONE 'Africa/Johannesburg';
  ELSE
    v_base_start := p_start_from;
  END IF;

  RAISE NOTICE '📅 Base start time: %', v_base_start;

  -- Schedule stages using recursive CTE with correct column references
  WITH RECURSIVE stage_schedule AS (
    -- Base case: stages with no dependencies (stage_order = 1)
    SELECT
      jsi.id,
      jsi.job_id,
      jsi.stage_order,
      ps.name AS stage_name,  -- ✅ JOIN to get stage name
      jsi.estimated_duration_minutes,
      v_base_start AS slot_start,
      v_base_start + (jsi.estimated_duration_minutes || ' minutes')::interval AS slot_end,
      0 AS depth
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON ps.id = jsi.production_stage_id  -- ✅ Required JOIN
    WHERE jsi.stage_order = 1
      AND jsi.status != 'completed'  -- ✅ Correct: status not stage_status
    
    UNION ALL
    
    -- Recursive case: stages with dependencies
    SELECT
      jsi.id,
      jsi.job_id,
      jsi.stage_order,
      ps.name AS stage_name,  -- ✅ JOIN in recursive case too
      jsi.estimated_duration_minutes,
      GREATEST(
        ss.slot_end,
        -- Check if a gap exists due to missing predecessor
        CASE 
          WHEN EXISTS (
            SELECT 1 
            FROM public.job_stage_instances pred
            WHERE pred.job_id = jsi.job_id
              AND pred.stage_order < jsi.stage_order
              AND pred.scheduled_start_at IS NULL
          )
          THEN ss.slot_end + interval '1 hour'  -- Add gap to flag precedence issue
          ELSE ss.slot_end
        END
      ) AS slot_start,
      GREATEST(
        ss.slot_end,
        CASE 
          WHEN EXISTS (
            SELECT 1 
            FROM public.job_stage_instances pred
            WHERE pred.job_id = jsi.job_id
              AND pred.stage_order < jsi.stage_order
              AND pred.scheduled_start_at IS NULL
          )
          THEN ss.slot_end + interval '1 hour'
          ELSE ss.slot_end
        END
      ) + (jsi.estimated_duration_minutes || ' minutes')::interval AS slot_end,
      ss.depth + 1 AS depth
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON ps.id = jsi.production_stage_id  -- ✅ JOIN in recursive case
    JOIN stage_schedule ss ON jsi.job_id = ss.job_id AND jsi.stage_order = ss.stage_order + 1
    WHERE jsi.status != 'completed'  -- ✅ Correct column
  ),
  
  -- Pre-aggregate completed barriers to avoid nested aggregate error
  barrier_agg AS (
    SELECT 
      ss.id,
      jsonb_object_agg(
        pred_data.stage_name,
        jsonb_build_object(
          'completed_at', pred_data.completed_at,
          'max_completed', pred_data.max_completed
        )
      ) AS completed_barriers_json
    FROM stage_schedule ss
    LEFT JOIN LATERAL (
      SELECT 
        ps.name AS stage_name,  -- ✅ JOIN production_stages to get name
        pred.completed_at,
        MAX(pred.completed_at) OVER (PARTITION BY pred.job_id) as max_completed
      FROM public.job_stage_instances pred
      JOIN public.production_stages ps ON ps.id = pred.production_stage_id  -- ✅ Required JOIN
      WHERE pred.job_id = ss.job_id
        AND pred.stage_order < ss.stage_order
        AND pred.status = 'completed'  -- ✅ Correct: status not stage_status
    ) pred_data ON true
    GROUP BY ss.id
  ),
  
  -- Insert scheduled slots
  updated_stages AS (
    INSERT INTO public.stage_time_slots (
      production_stage_id,
      stage_instance_id,
      slot_start_time,
      slot_end_time,
      duration_minutes,
      job_id,
      date
    )
    SELECT
      ps.id,
      ss.id,
      ss.slot_start,
      ss.slot_end,
      ss.estimated_duration_minutes,
      ss.job_id,
      DATE(ss.slot_start AT TIME ZONE 'Africa/Johannesburg')
    FROM stage_schedule ss
    JOIN public.production_stages ps ON LOWER(TRIM(ps.name)) = LOWER(TRIM(ss.stage_name))
    RETURNING stage_instance_id
  ),
  
  -- Update job_stage_instances with scheduled times
  schedule_updates AS (
    UPDATE public.job_stage_instances jsi
    SET 
      scheduled_start_at = ss.slot_start,
      scheduled_end_at = ss.slot_end
    FROM stage_schedule ss
    WHERE jsi.id = ss.id
    RETURNING 
      jsi.id, 
      jsi.job_id, 
      jsi.stage_order, 
      ss.stage_name,  -- ✅ Use from stage_schedule (already resolved)
      ss.slot_start, 
      ss.slot_end,
      EXTRACT(EPOCH FROM (ss.slot_start - v_base_start))/86400.0 AS days_saved
  )
  
  -- Return results with violation detection
  SELECT 
    COUNT(DISTINCT su.id)::int,
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'job_id', su.job_id,
          'stage_order', su.stage_order,
          'stage_name', su.stage_name,
          'scheduled_start', su.slot_start,
          'days_saved', ROUND(su.days_saved::numeric, 2),
          'completed_barriers', ba.completed_barriers_json
        )
      ) FILTER (WHERE su.days_saved >= 0.25),  -- Only flag if 6+ hours saved
      '[]'::jsonb
    )
  INTO v_scheduled_count, v_violations
  FROM schedule_updates su
  LEFT JOIN barrier_agg ba ON ba.id = su.id;

  -- Get count of written slots
  SELECT COUNT(*)::int INTO v_wrote_slots FROM public.stage_time_slots;

  RAISE NOTICE '✅ Scheduled % stages, wrote % slots', v_scheduled_count, v_wrote_slots;

  RETURN jsonb_build_object(
    'success', true,
    'scheduled_count', v_scheduled_count,
    'wrote_slots', v_wrote_slots,
    'violations', v_violations,
    'base_start', v_base_start
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error in scheduler_reschedule_all_parallel_aware: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'scheduled_count', 0,
      'wrote_slots', 0
    );
END;
$$;

ALTER FUNCTION public.scheduler_reschedule_all_parallel_aware(timestamptz) OWNER TO postgres;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Test the function:
-- SELECT public.scheduler_reschedule_all_parallel_aware(now()::timestamptz);
-- 
-- Expected: JSONB with keys: success, scheduled_count, wrote_slots, violations
-- Should have NO "column does not exist" errors
-- ============================================================
