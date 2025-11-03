-- Fix scheduler to use per-resource timeline tracking instead of global timeline
-- This ensures Packaging, Shipping, and other stages maintain independent queues

DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized(timestamp with time zone);

CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized(p_start_from timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_base_start timestamp with time zone;
    v_wrote_slots integer := 0;
    v_updated_jsi integer := 0;
    v_violations jsonb := '[]'::jsonb;
    v_stage record;
    v_duration_minutes integer;
    v_slot_start timestamp with time zone;
    v_slot_end timestamp with time zone;
    v_working_date date;
    v_resource_available_at timestamp with time zone;
BEGIN
    -- Set base start time - if before 8 AM, use same day at 8 AM; otherwise next working day
    IF p_start_from IS NULL THEN
        v_base_start := CASE 
            WHEN EXTRACT(hour FROM NOW() AT TIME ZONE 'Africa/Johannesburg') < 8 
            THEN (NOW() AT TIME ZONE 'Africa/Johannesburg')::date + interval '8 hours'
            ELSE (NOW() AT TIME ZONE 'Africa/Johannesburg')::date + interval '1 day' + interval '8 hours'
        END;
    ELSE
        v_base_start := CASE 
            WHEN EXTRACT(hour FROM p_start_from AT TIME ZONE 'Africa/Johannesburg') < 8 
            THEN (p_start_from AT TIME ZONE 'Africa/Johannesburg')::date + interval '8 hours'
            ELSE p_start_from
        END;
    END IF;

    -- Find next working day if needed
    v_working_date := v_base_start::date;
    WHILE EXTRACT(dow FROM v_working_date) IN (0, 6) OR EXISTS (
        SELECT 1 FROM public_holidays WHERE date = v_working_date AND is_active = true
    ) LOOP
        v_working_date := v_working_date + interval '1 day';
    END LOOP;
    v_base_start := v_working_date + time '08:00:00';

    RAISE NOTICE 'Starting resource-aware scheduler with base_start: %', v_base_start;

    -- Create temporary table to track next available time per production stage (resource)
    CREATE TEMP TABLE IF NOT EXISTS _stage_tails (
        stage_id UUID PRIMARY KEY,
        next_available_time TIMESTAMPTZ NOT NULL
    ) ON COMMIT DROP;

    -- Initialize stage tails with last scheduled end time for each production stage
    -- Include ALL slots (completed and scheduled) to respect existing work
    INSERT INTO _stage_tails (stage_id, next_available_time)
    SELECT 
        production_stage_id,
        COALESCE(MAX(slot_end_time), v_base_start)
    FROM stage_time_slots
    WHERE production_stage_id IS NOT NULL
      -- Exclude PROOF/DTP/Batch stages from timeline calculations
      AND NOT EXISTS (
          SELECT 1 FROM production_stages ps 
          WHERE ps.id = production_stage_id 
          AND (ps.name ILIKE '%dtp%' OR ps.name ILIKE '%proof%' OR ps.name ILIKE '%batch%')
      )
    GROUP BY production_stage_id
    ON CONFLICT (stage_id) DO NOTHING;

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

    -- Process each pending stage in FIFO order (proof_approved_at, then stage_order)
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
          AND j.proof_approved_at IS NOT NULL
        ORDER BY j.proof_approved_at ASC, jsi.stage_order ASC
    LOOP
        -- Get duration for this stage
        v_duration_minutes := v_stage.duration_minutes;
        
        IF v_duration_minutes IS NULL OR v_duration_minutes <= 0 THEN
            v_duration_minutes := 60; -- Default 1 hour
        END IF;

        -- Get next available time for THIS specific resource (production stage)
        SELECT COALESCE(next_available_time, v_base_start)
        INTO v_resource_available_at
        FROM _stage_tails
        WHERE stage_id = v_stage.production_stage_id;

        -- If resource not in tails yet, initialize it
        IF v_resource_available_at IS NULL THEN
            v_resource_available_at := v_base_start;
            INSERT INTO _stage_tails (stage_id, next_available_time)
            VALUES (v_stage.production_stage_id, v_base_start)
            ON CONFLICT (stage_id) DO NOTHING;
        END IF;

        -- Start scheduling from resource's next available time
        v_slot_start := v_resource_available_at;
        
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
        
        -- Update ONLY this resource's next available time (not global)
        INSERT INTO _stage_tails (stage_id, next_available_time)
        VALUES (v_stage.production_stage_id, v_slot_end)
        ON CONFLICT (stage_id) DO UPDATE SET next_available_time = v_slot_end;
        
        RAISE NOTICE 'Scheduled % for job % on resource % from % to %', 
            v_stage.stage_name, v_stage.wo_no, v_stage.production_stage_id, v_slot_start, v_slot_end;
    END LOOP;

    RETURN jsonb_build_object(
        'wrote_slots', v_wrote_slots,
        'updated_jsi', v_updated_jsi,
        'violations', v_violations
    );
END;
$function$;