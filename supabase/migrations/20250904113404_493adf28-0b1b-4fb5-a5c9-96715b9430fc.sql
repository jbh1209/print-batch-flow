-- Fix Problem #1: Critical Barrier Logic for Completed Stages
-- This fixes the core issue where completed stages with NULL scheduled_end_at break dependency calculations

-- First, create a helper function to get actual stage end time (completed_at or scheduled_end_at)
CREATE OR REPLACE FUNCTION public.get_actual_stage_end_time(p_stage_instance_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsi.scheduled_end_at,
    jsi.completed_at,
    -- Fallback: if both are null, use start time + estimated duration
    (jsi.started_at + make_interval(mins => COALESCE(jsi.estimated_duration_minutes, 60)))
  )
  FROM job_stage_instances jsi
  WHERE jsi.id = p_stage_instance_id;
$$;

-- Update the barrier calculation function to handle completed stages properly
CREATE OR REPLACE FUNCTION public.calculate_job_completion_barrier(p_job_id uuid, p_current_stage_order integer, p_part_assignment text DEFAULT 'main')
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  max_end_time timestamptz;
  base_time timestamptz := now();
BEGIN
  -- Find the maximum actual end time from all completed/active stages at previous orders
  -- This handles both completed stages with NULL scheduled_end_at and properly scheduled stages
  SELECT GREATEST(
    base_time,
    COALESCE(MAX(
      CASE 
        WHEN jsi.status = 'completed' THEN 
          -- For completed stages, use actual completion time or scheduled end time
          COALESCE(jsi.completed_at, jsi.scheduled_end_at)
        WHEN jsi.status = 'active' AND jsi.started_at IS NOT NULL THEN
          -- For active stages, estimate end time based on start + duration
          (jsi.started_at + make_interval(mins => COALESCE(jsi.estimated_duration_minutes, 60)))
        ELSE 
          -- For scheduled stages, use scheduled end time
          jsi.scheduled_end_at
      END
    ), base_time)
  ) INTO max_end_time
  FROM job_stage_instances jsi
  WHERE jsi.job_id = p_job_id
    AND jsi.stage_order < p_current_stage_order
    AND (
      p_part_assignment = 'main' OR 
      jsi.part_assignment = p_part_assignment OR 
      jsi.part_assignment = 'both' OR
      jsi.part_assignment IS NULL
    )
    AND jsi.status IN ('completed', 'active', 'scheduled');

  RETURN COALESCE(max_end_time, base_time);
END;
$$;

-- Create an enhanced scheduler function that properly handles completed stages
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_barrier_fixed(p_start_from timestamptz DEFAULT NULL)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  
  -- Job processing variables
  r_job record;
  r_stage_group record;
  r_stage record;
  
  -- Enhanced barrier tracking
  job_stage_barriers jsonb := '{}'::jsonb;
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  calculated_barrier timestamptz;
  barrier_key text;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 43);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting BARRIER-FIXED scheduler from: %', base_time;

  -- Clear existing non-completed slots only
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  RAISE NOTICE 'Cleared existing non-completed time slots';

  -- Clear scheduling data for non-completed stages only
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE COALESCE(status, '') NOT IN ('completed', 'active');
  
  RAISE NOTICE 'Cleared scheduling data from non-completed job_stage_instances';

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize stages accounting for completed work
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    GREATEST(
      COALESCE(MAX(slot_end_time), base_time),
      base_time
    )
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- Initialize any untracked stages
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
  ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE 'Initialized % production stages with barrier-aware logic', (SELECT COUNT(*) FROM _stage_tails);

  -- Process jobs in FIFO order by proof_approved_at
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.proof_approved_at,
      pj.wo_no,
      COUNT(jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    -- Initialize job barriers with actual completion times from completed stages
    job_stage_barriers := '{}'::jsonb;
    
    RAISE NOTICE 'Processing job % (WO: %) with barrier-fixed logic', 
      r_job.job_id, r_job.wo_no;
    
    -- Process stages grouped by stage_order to handle parallel stages
    FOR r_stage_group IN
      SELECT 
        stage_order,
        array_agg(jsi.id) as stage_instance_ids,
        array_agg(DISTINCT jsi.part_assignment) FILTER (WHERE jsi.part_assignment IS NOT NULL) as parts_in_group,
        COUNT(*) as stages_in_group
      FROM job_stage_instances jsi
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      GROUP BY stage_order
      ORDER BY stage_order ASC
    LOOP
      RAISE NOTICE 'Processing stage group order % with % stages (parts: %)',
        r_stage_group.stage_order, r_stage_group.stages_in_group, r_stage_group.parts_in_group;
      
      -- Process each stage in this parallel group
      FOR r_stage IN
        SELECT 
          jsi.id as stage_instance_id,
          jsi.production_stage_id,
          jsi.stage_order,
          jsi.part_assignment,
          jsi.dependency_group,
          public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
          ps.name as stage_name
        FROM job_stage_instances jsi
        JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.id = ANY(r_stage_group.stage_instance_ids)
        ORDER BY jsi.id
      LOOP
        -- CRITICAL FIX: Use the enhanced barrier calculation function
        barrier_key := COALESCE(r_stage.part_assignment, 'main');
        calculated_barrier := public.calculate_job_completion_barrier(
          r_job.job_id, 
          r_stage.stage_order, 
          barrier_key
        );
        
        -- Ensure we don't schedule before proof approval or base time
        stage_earliest_start := GREATEST(
          calculated_barrier,
          COALESCE(r_job.proof_approved_at, base_time),
          base_time
        );

        -- Get resource availability
        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        -- Stage must wait for both job barrier and resource availability
        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        RAISE NOTICE 'Scheduling stage % (%): % mins from % (barrier: % = %)',
          r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
          stage_earliest_start, barrier_key, calculated_barrier;

        -- Place the duration
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
        
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE EXCEPTION 'FAILED to schedule stage % (%) for job % - placement failed at %',
            r_stage.stage_name, r_stage.stage_instance_id, r_job.job_id, stage_earliest_start;
        END IF;

        IF jsonb_array_length(placement_result.slots_created) = 0 THEN
          RAISE EXCEPTION 'FAILED to schedule stage % (%) for job % - no slots created',
            r_stage.stage_name, r_stage.stage_instance_id, r_job.job_id;
        END IF;

        -- Create time slots from placement result
        FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
        LOOP
          INSERT INTO stage_time_slots(
            production_stage_id,
            date,
            slot_start_time,
            slot_end_time,
            duration_minutes,
            job_id,
            job_table_name,
            stage_instance_id,
            is_completed
          )
          VALUES (
            r_stage.production_stage_id,
            (slot_record ->> 'date')::date,
            (slot_record ->> 'start_time')::timestamptz,
            (slot_record ->> 'end_time')::timestamptz,
            (slot_record ->> 'duration_minutes')::integer,
            r_job.job_id,
            'production_jobs',
            r_stage.stage_instance_id,
            false
          );
          wrote_count := wrote_count + 1;
        END LOOP;

        -- Calculate stage end time
        SELECT MAX((time_slot ->> 'end_time')::timestamptz)
        INTO stage_end_time
        FROM jsonb_array_elements(placement_result.slots_created) time_slot;

        -- Update resource availability
        UPDATE _stage_tails 
        SET next_available_time = stage_end_time
        WHERE stage_id = r_stage.production_stage_id;

        -- Update job stage instance
        UPDATE job_stage_instances
        SET 
          scheduled_minutes = r_stage.duration_minutes,
          scheduled_start_at = (
            SELECT MIN((time_slot ->> 'start_time')::timestamptz)
            FROM jsonb_array_elements(placement_result.slots_created) time_slot
          ),
          scheduled_end_at = stage_end_time,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = r_stage.stage_instance_id;
        updated_count := updated_count + 1;

        -- Update the barrier for this part/job
        job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(stage_end_time));

        RAISE NOTICE 'Completed scheduling stage % - ends at % (updated barrier %)',
          r_stage.stage_name, stage_end_time, barrier_key;
      END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Completed job % with enhanced barrier logic', r_job.job_id;
  END LOOP;

  -- Validation
  SELECT jsonb_agg(
    jsonb_build_object(
      'job_id', v.job_id,
      'violation_type', v.violation_type,
      'stage1_name', v.stage1_name,
      'stage1_order', v.stage1_order,
      'stage2_name', v.stage2_name,
      'stage2_order', v.stage2_order,
      'violation_details', v.violation_details
    )
  ) INTO validation_results
  FROM public.validate_job_scheduling_precedence() v;

  IF validation_results IS NULL THEN
    validation_results := '[]'::jsonb;
  END IF;

  RAISE NOTICE 'BARRIER-FIXED Scheduler complete: wrote % slots, updated % stage instances, found % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'BARRIER-FIXED Scheduler failed: %', SQLERRM;
END;
$$;

-- Update the wrapper to use the new barrier-fixed scheduler
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all'::text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result record;
  response jsonb;
BEGIN
  CASE p_mode
    WHEN 'reschedule_all' THEN
      -- Use the new barrier-fixed scheduler
      SELECT * INTO result FROM public.scheduler_reschedule_all_barrier_fixed();
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'violations', result.violations,
        'mode', 'reschedule_all_barrier_fixed'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  
  RETURN response;
END;
$$;