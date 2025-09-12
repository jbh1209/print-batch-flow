-- Revert scheduler_resource_fill_optimized to last working version
-- Keep time-aware logic but remove non-existent function dependencies

CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized(
    p_start_from timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_from timestamp with time zone;
    v_wrote_slots integer := 0;
    v_updated_jsi integer := 0;
    v_violations jsonb := '[]'::jsonb;
    v_stage record;
    v_job record;
    v_duration_minutes integer;
    v_placement_result jsonb;
BEGIN
    -- Set start time - if before 8 AM, use same day at 8 AM; otherwise next working day
    IF p_start_from IS NULL THEN
        v_start_from := CASE 
            WHEN EXTRACT(hour FROM NOW() AT TIME ZONE 'Africa/Johannesburg') < 8 
            THEN (NOW() AT TIME ZONE 'Africa/Johannesburg')::date + interval '8 hours'
            ELSE get_next_working_day((NOW() AT TIME ZONE 'Africa/Johannesburg')::date) + interval '8 hours'
        END;
    ELSE
        v_start_from := CASE 
            WHEN EXTRACT(hour FROM p_start_from AT TIME ZONE 'Africa/Johannesburg') < 8 
            THEN (p_start_from AT TIME ZONE 'Africa/Johannesburg')::date + interval '8 hours'
            ELSE p_start_from
        END;
    END IF;

    RAISE NOTICE 'Starting scheduler_resource_fill_optimized with start_from: %', v_start_from;

    -- Process each pending stage in proof_approved_at order
    FOR v_stage IN
        SELECT jsi.*, 
               ps.name as stage_name,
               ps.duration_minutes,
               j.proof_approved_at
        FROM job_stage_instances jsi
        JOIN production_stages ps ON jsi.production_stage_id = ps.id
        JOIN production_jobs j ON jsi.job_id = j.id
        WHERE jsi.status IN ('pending', 'active')
          AND ps.name NOT IN ('DTP', 'proof', 'batch allocation')
          AND j.proof_approved_at IS NOT NULL  -- Only process jobs with approved proofs
        ORDER BY j.proof_approved_at ASC, jsi.stage_order ASC
    LOOP
        -- Get duration for this stage
        v_duration_minutes := v_stage.duration_minutes;
        
        IF v_duration_minutes IS NULL OR v_duration_minutes <= 0 THEN
            CONTINUE;
        END IF;

        -- Use the existing place_duration_sql function for placement
        SELECT place_duration_sql(
            v_start_from,
            v_duration_minutes,
            60 -- horizon days
        ) INTO v_placement_result;

        -- If placement successful, create slots
        IF v_placement_result->>'success' = 'true' THEN
            -- Insert slots using the proven slot insertion logic
            INSERT INTO stage_time_slots (
                production_stage_id,
                stage_instance_id,
                slot_start_time,
                slot_end_time,
                allocated_minutes
            )
            SELECT 
                v_stage.production_stage_id,
                v_stage.id,
                (slot_info->>'start')::timestamp with time zone,
                (slot_info->>'end')::timestamp with time zone,
                (slot_info->>'minutes')::integer
            FROM jsonb_array_elements(v_placement_result->'slots') AS slot_info;
            
            -- Update stage instance with schedule info
            UPDATE job_stage_instances 
            SET 
                scheduled_start_at = (v_placement_result->'slots'->0->>'start')::timestamp with time zone,
                scheduled_end_at = (v_placement_result->'slots'->-1->>'end')::timestamp with time zone,
                scheduled_minutes = v_duration_minutes,
                status = 'scheduled'
            WHERE id = v_stage.id;
            
            v_wrote_slots := v_wrote_slots + jsonb_array_length(v_placement_result->'slots');
            v_updated_jsi := v_updated_jsi + 1;
            
            -- Update start time for next stage
            v_start_from := (v_placement_result->'slots'->-1->>'end')::timestamp with time zone;
        ELSE
            -- Log placement failure
            RAISE NOTICE 'Failed to place stage % for job %: %', 
                v_stage.stage_name, v_stage.job_id, v_placement_result->>'error';
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'wrote_slots', v_wrote_slots,
        'updated_jsi', v_updated_jsi,
        'violations', v_violations
    );
END;
$$;