-- EMERGENCY SCHEDULER STANDARDIZATION MIGRATION - FIXED
-- Phase 1: Fix Critical Data Issues - Backfill missing proof_approved_manually_at timestamps

-- First, backfill missing proof_approved_manually_at for jobs D426519-D426524
-- This will trigger the sync_proof_approval_timestamps trigger automatically
UPDATE job_stage_instances 
SET 
  proof_approved_manually_at = COALESCE(
    (SELECT pj.proof_approved_at FROM production_jobs pj WHERE pj.id = job_stage_instances.job_id),
    now() - interval '1 hour'  -- Default to 1 hour ago if no proof_approved_at exists
  ),
  updated_at = now()
WHERE job_id IN (
  SELECT id FROM production_jobs 
  WHERE wo_no IN ('D426519', 'D426520', 'D426521', 'D426522', 'D426523', 'D426524')
)
AND production_stage_id IN (
  SELECT id FROM production_stages WHERE name ILIKE '%proof%'
)
AND proof_approved_manually_at IS NULL;

-- Phase 2: Standardize All Scheduler Functions
-- Drop existing scheduler_append_jobs if it exists
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(uuid[], timestamptz, boolean);

-- Create scheduler_append_jobs function for individual job scheduling
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(p_job_ids uuid[], p_start_from timestamptz DEFAULT NULL, p_only_if_unset boolean DEFAULT true)
RETURNS TABLE(updated_jsi integer, wrote_slots integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  job_id uuid;
  stage_record RECORD;
  base_time timestamptz;
  slot_start timestamptz;
  slot_end timestamptz;
  working_date date;
  total_updated integer := 0;
  total_slots integer := 0;
BEGIN
  -- Use provided start time or default to next working day 8 AM
  IF p_start_from IS NOT NULL THEN
    base_time := p_start_from;
  ELSE
    working_date := CURRENT_DATE + interval '1 day';
    -- Find next working day (skip weekends and holidays)
    WHILE EXTRACT(dow FROM working_date) IN (0, 6) OR EXISTS (
      SELECT 1 FROM public_holidays WHERE date = working_date::date AND is_active = true
    ) LOOP
      working_date := working_date + interval '1 day';
    END LOOP;
    base_time := working_date + time '08:00:00';
  END IF;

  -- Process each job ID
  FOREACH job_id IN ARRAY p_job_ids
  LOOP
    RAISE NOTICE 'Appending job % to schedule starting from %', job_id, base_time;
    
    -- Find the earliest available slot and schedule all pending stages for this job
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.stage_order,
        COALESCE(jsi.estimated_duration_minutes, 60) as duration_minutes,
        ps.name as stage_name,
        pj.wo_no
      FROM job_stage_instances jsi
      JOIN production_stages ps ON jsi.production_stage_id = ps.id
      JOIN production_jobs pj ON jsi.job_id = pj.id
      WHERE jsi.job_id = job_id
        AND jsi.job_table_name = 'production_jobs'
        AND jsi.status = 'pending'
        AND (p_only_if_unset = false OR jsi.scheduled_start_at IS NULL)
      ORDER BY jsi.stage_order
    LOOP
      -- Find next available time for this stage by looking at existing slots
      SELECT COALESCE(MAX(slot_end_time), base_time) INTO slot_start
      FROM stage_time_slots sts
      WHERE sts.production_stage_id = stage_record.production_stage_id
        AND sts.slot_end_time >= base_time;

      -- Ensure we're in working hours (8:00-16:30 with 12:00-12:30 lunch)
      WHILE TRUE LOOP
        -- Check if we're in working hours
        IF EXTRACT(hour FROM slot_start) < 8 THEN
          slot_start := slot_start::date + time '08:00:00';
        ELSIF EXTRACT(hour FROM slot_start) >= 16 OR 
              (EXTRACT(hour FROM slot_start) = 12 AND EXTRACT(minute FROM slot_start) < 30) THEN
          -- Move to next working day
          working_date := (slot_start::date + interval '1 day');
          WHILE EXTRACT(dow FROM working_date) IN (0, 6) OR EXISTS (
            SELECT 1 FROM public_holidays WHERE date = working_date::date AND is_active = true
          ) LOOP
            working_date := working_date + interval '1 day';
          END LOOP;
          slot_start := working_date + time '08:00:00';
        ELSIF EXTRACT(hour FROM slot_start) = 12 AND EXTRACT(minute FROM slot_start) >= 0 THEN
          slot_start := slot_start::date + time '12:30:00';
        ELSE
          EXIT; -- We're in valid working hours
        END IF;
      END LOOP;

      slot_end := slot_start + make_interval(mins => stage_record.duration_minutes);

      -- Update job stage instance with schedule
      UPDATE job_stage_instances 
      SET 
        scheduled_start_at = slot_start,
        scheduled_end_at = slot_end,
        scheduled_minutes = stage_record.duration_minutes,
        schedule_status = 'scheduled',
        updated_at = now()
      WHERE id = stage_record.id;

      -- Create time slot
      INSERT INTO stage_time_slots (
        production_stage_id,
        job_id,
        stage_instance_id,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        job_table_name
      ) VALUES (
        stage_record.production_stage_id,
        job_id,
        stage_record.id,
        slot_start,
        slot_end,
        stage_record.duration_minutes,
        'production_jobs'
      );

      total_updated := total_updated + 1;
      total_slots := total_slots + 1;

      RAISE NOTICE 'Scheduled % for job % from % to %', 
        stage_record.stage_name, stage_record.wo_no, slot_start, slot_end;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT total_updated, total_slots;
END;
$function$;

-- Update simple_scheduler_wrapper to ONLY use scheduler_resource_fill_optimized
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result record;
  response jsonb;
BEGIN
  CASE p_mode
    WHEN 'reschedule_all' THEN
      -- STANDARDIZED: Always use scheduler_resource_fill_optimized
      SELECT * INTO result FROM public.scheduler_resource_fill_optimized();
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'violations', result.violations,
        'mode', 'resource_fill_optimized'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  
  RETURN response;
END;
$function$;