-- Fix scheduler to only process proof-approved jobs and clean up duplicate slots

-- Step 1: Add proof approval filter to v_scheduler_stages_ready view
CREATE OR REPLACE VIEW public.v_scheduler_stages_ready AS
SELECT 
  jsi.*,
  ps.name as stage_name,
  ps.group_name as stage_group
FROM public.job_stage_instances jsi
JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
JOIN public.production_jobs pj ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
WHERE jsi.status IN ('pending', 'scheduled')
  AND jsi.job_table_name = 'production_jobs'
  -- CRITICAL: Only include proof-approved jobs
  AND pj.proof_approved_at IS NOT NULL
  AND ps.is_active = true;

-- Step 2: Clean up duplicate time slots (keep only the latest one per stage instance)
WITH duplicates AS (
  SELECT 
    stage_instance_id,
    COUNT(*) as slot_count,
    array_agg(id ORDER BY created_at DESC) as slot_ids
  FROM public.stage_time_slots 
  WHERE stage_instance_id IS NOT NULL
  GROUP BY stage_instance_id
  HAVING COUNT(*) > 1
),
slots_to_delete AS (
  SELECT unnest(slot_ids[2:]) as id_to_delete
  FROM duplicates
)
DELETE FROM public.stage_time_slots 
WHERE id IN (SELECT id_to_delete FROM slots_to_delete);

-- Step 3: Update shift window function to ensure times stay within business hours
CREATE OR REPLACE FUNCTION public.shift_window_with_breaks(p_date date)
RETURNS TABLE(
  win_start timestamp with time zone, 
  win_end timestamp with time zone,
  morning_start timestamp with time zone,
  morning_end timestamp with time zone, 
  afternoon_start timestamp with time zone,
  afternoon_end timestamp with time zone,
  lunch_start timestamp with time zone,
  lunch_end timestamp with time zone
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (p_date::timestamptz + ss.shift_start_time) as win_start,
    (p_date::timestamptz + ss.shift_end_time) as win_end,
    -- Morning session: start to lunch
    (p_date::timestamptz + ss.shift_start_time) as morning_start,
    CASE WHEN ss.lunch_break_start_time IS NOT NULL 
         THEN (p_date::timestamptz + ss.lunch_break_start_time)
         ELSE (p_date::timestamptz + ss.shift_end_time)
    END as morning_end,
    -- Afternoon session: lunch end to day end
    CASE WHEN ss.lunch_break_start_time IS NOT NULL AND ss.lunch_break_duration_minutes > 0
         THEN (p_date::timestamptz + ss.lunch_break_start_time + make_interval(mins => ss.lunch_break_duration_minutes))
         ELSE (p_date::timestamptz + ss.shift_start_time)
    END as afternoon_start,
    (p_date::timestamptz + ss.shift_end_time) as afternoon_end,
    -- Lunch break times
    CASE WHEN ss.lunch_break_start_time IS NOT NULL 
         THEN (p_date::timestamptz + ss.lunch_break_start_time)
         ELSE NULL 
    END as lunch_start,
    CASE WHEN ss.lunch_break_start_time IS NOT NULL AND ss.lunch_break_duration_minutes > 0
         THEN (p_date::timestamptz + ss.lunch_break_start_time + make_interval(mins => ss.lunch_break_duration_minutes))
         ELSE NULL 
    END as lunch_end
  FROM shift_schedules ss
  WHERE ss.day_of_week = EXTRACT(dow FROM p_date)::int
    AND COALESCE(ss.is_active, true) = true
  LIMIT 1;
$$;