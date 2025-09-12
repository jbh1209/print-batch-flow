-- Fix ambiguous function call by removing default parameter and updating wrapper
-- Drop the existing function with default parameter
DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized(timestamp with time zone);

-- Recreate without default parameter to avoid ambiguity
CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized(p_start_from timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_start_from timestamp with time zone;
    v_wrote_slots integer := 0;
    v_updated_jsi integer := 0;
    v_violations jsonb := '[]'::jsonb;
    v_stage record;
    v_duration_minutes integer;
    v_slot_start timestamp with time zone;
    v_slot_end timestamp with time zone;
    v_working_date date;
BEGIN
    -- Set start time - if before 8 AM, use same day at 8 AM; otherwise next working day
    IF p_start_from IS NULL THEN
        v_start_from := CASE 
            WHEN EXTRACT(hour FROM NOW() AT TIME ZONE 'Africa/Johannesburg') < 8 
            THEN (NOW() AT TIME ZONE 'Africa/Johannesburg')::date + interval '8 hours'
            ELSE (NOW() AT TIME ZONE 'Africa/Johannesburg')::date + interval '1 day' + interval '8 hours'
        END;
    ELSE
        v_start_from := CASE 
            WHEN EXTRACT(hour FROM p_start_from AT TIME ZONE 'Africa/Johannesburg') < 8 
            THEN (p_start_from AT TIME ZONE 'Africa/Johannesburg')::date + interval '8 hours'
            ELSE p_start_from
        END;
    END IF;

    -- Find next working day if needed
    v_working_date := v_start_from::date;
    WHILE EXTRACT(dow FROM v_working_date) IN (0, 6) OR EXISTS (
        SELECT 1 FROM public_holidays WHERE date = v_working_date AND is_active = true
    ) LOOP
        v_working_date := v_working_date + interval '1 day';
    END LOOP;
    v_start_from := v_working_date + time '08:00:00';

    RAISE NOTICE 'Starting scheduler_resource_fill_optimized with start_from: %', v_start_from;

    -- Clear existing schedules for pending stages
    UPDATE job_stage_instances 
    SET 
        scheduled_start_at = NULL,
        scheduled_end_at = NULL,
        scheduled_minutes = NULL,
        schedule_status = NULL,
        updated_at = now()
    WHERE status = 'pending';

    -- Clear existing time slots for non-completed stages
    DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;

    -- Process each pending stage in proof_approved_at order
    FOR v_stage IN
        SELECT jsi.*, 
               ps.name as stage_name,
               COALESCE(jsi.estimated_duration_minutes, ps.duration_minutes, 60) as duration_minutes,
               j.proof_approved_at,
               j.wo_no
        FROM job_stage_instances jsi
        JOIN production_stages ps ON jsi.production_stage_id = ps.id
        JOIN production_jobs j ON jsi.job_id = j.id
        WHERE jsi.status = 'pending'
          AND ps.name NOT ILIKE '%dtp%'
          AND ps.name NOT ILIKE '%proof%'
          AND ps.name NOT ILIKE '%batch%'
          AND j.proof_approved_at IS NOT NULL  -- Only process jobs with approved proofs
        ORDER BY j.proof_approved_at ASC, jsi.stage_order ASC
    LOOP
        -- Get duration for this stage
        v_duration_minutes := v_stage.duration_minutes;
        
        IF v_duration_minutes IS NULL OR v_duration_minutes <= 0 THEN
            v_duration_minutes := 60; -- Default 1 hour
        END IF;

        -- Find next available slot
        v_slot_start := v_start_from;
        
        -- Ensure we're in working hours (8:00-16:30 with 12:00-12:30 lunch)
        WHILE TRUE LOOP
            -- Check if we're in working hours
            IF EXTRACT(hour FROM v_slot_start) < 8 THEN
                v_slot_start := v_slot_start::date + time '08:00:00';
            ELSIF EXTRACT(hour FROM v_slot_start) >= 16 OR 
                  (EXTRACT(hour FROM v_slot_start) = 12 AND EXTRACT(minute FROM v_slot_start) < 30) THEN
                -- Move to next working day
                v_working_date := (v_slot_start::date + interval '1 day');
                WHILE EXTRACT(dow FROM v_working_date) IN (0, 6) OR EXISTS (
                    SELECT 1 FROM public_holidays WHERE date = v_working_date AND is_active = true
                ) LOOP
                    v_working_date := v_working_date + interval '1 day';
                END LOOP;
                v_slot_start := v_working_date + time '08:00:00';
            ELSIF EXTRACT(hour FROM v_slot_start) = 12 AND EXTRACT(minute FROM v_slot_start) >= 0 THEN
                v_slot_start := v_slot_start::date + time '12:30:00';
            ELSE
                EXIT; -- We're in valid working hours
            END IF;
        END LOOP;

        v_slot_end := v_slot_start + make_interval(mins => v_duration_minutes);

        -- Update stage instance with schedule info
        UPDATE job_stage_instances 
        SET 
            scheduled_start_at = v_slot_start,
            scheduled_end_at = v_slot_end,
            scheduled_minutes = v_duration_minutes,
            schedule_status = 'scheduled',
            updated_at = now()
        WHERE id = v_stage.id;
        
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
            v_stage.production_stage_id,
            v_stage.job_id,
            v_stage.id,
            v_slot_start,
            v_slot_end,
            v_duration_minutes,
            'production_jobs'
        );
        
        v_wrote_slots := v_wrote_slots + 1;
        v_updated_jsi := v_updated_jsi + 1;
        
        -- Update start time for next stage
        v_start_from := v_slot_end;
        
        RAISE NOTICE 'Scheduled % for job % from % to %', 
            v_stage.stage_name, v_stage.wo_no, v_slot_start, v_slot_end;
    END LOOP;

    RETURN jsonb_build_object(
        'wrote_slots', v_wrote_slots,
        'updated_jsi', v_updated_jsi,
        'violations', v_violations
    );
END;
$function$;

-- Update simple_scheduler_wrapper to explicitly call with NULL and parse jsonb result
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  CASE p_mode
    WHEN 'reschedule_all' THEN
      -- Explicitly call the one-argument function with NULL
      SELECT public.scheduler_resource_fill_optimized(NULL::timestamp with time zone) INTO result;
      
      -- Return in expected format for UI compatibility
      RETURN jsonb_build_object(
        'success', true,
        'scheduled_count', (result->>'updated_jsi')::integer,
        'wrote_slots', (result->>'wrote_slots')::integer,
        'violations', result->'violations',
        'mode', 'resource_fill_optimized'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
END;
$function$;