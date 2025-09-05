-- Fix scheduler sequential dependencies by enhancing barrier calculation
-- This ensures stages cannot start until ALL previous stages (regardless of part) are completed

-- 1. Enhanced calculate_job_completion_barrier function with strict sequential enforcement
CREATE OR REPLACE FUNCTION public.calculate_job_completion_barrier(
  p_job_id uuid,
  p_current_stage_order integer,
  p_part_assignment text DEFAULT 'main'
) RETURNS timestamp with time zone
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  part_barrier_time timestamptz;
  sequential_barrier_time timestamptz;
  base_time timestamptz := now();
  final_barrier timestamptz;
BEGIN
  -- PART-SPECIFIC BARRIER: Find the maximum end time from relevant part assignments
  SELECT GREATEST(
    base_time,
    COALESCE(MAX(
      CASE 
        WHEN jsi.status = 'completed' THEN 
          COALESCE(jsi.completed_at, jsi.scheduled_end_at)
        WHEN jsi.status = 'active' AND jsi.started_at IS NOT NULL THEN
          (jsi.started_at + make_interval(mins => COALESCE(jsi.estimated_duration_minutes, 60)))
        ELSE 
          jsi.scheduled_end_at
      END
    ), base_time)
  ) INTO part_barrier_time
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

  -- SEQUENTIAL BARRIER: Find the maximum end time from ALL previous stages (regardless of part)
  -- This enforces strict sequential ordering within the job
  SELECT GREATEST(
    base_time,
    COALESCE(MAX(
      CASE 
        WHEN jsi.status = 'completed' THEN 
          COALESCE(jsi.completed_at, jsi.scheduled_end_at)
        WHEN jsi.status = 'active' AND jsi.started_at IS NOT NULL THEN
          (jsi.started_at + make_interval(mins => COALESCE(jsi.estimated_duration_minutes, 60)))
        ELSE 
          jsi.scheduled_end_at
      END
    ), base_time)
  ) INTO sequential_barrier_time
  FROM job_stage_instances jsi
  WHERE jsi.job_id = p_job_id
    AND jsi.stage_order < p_current_stage_order
    AND jsi.status IN ('completed', 'active', 'scheduled');

  -- Use the LATEST of the two barriers to ensure both part and sequential dependencies are respected
  final_barrier := GREATEST(
    COALESCE(part_barrier_time, base_time),
    COALESCE(sequential_barrier_time, base_time)
  );

  -- Log the barrier calculation for debugging
  RAISE NOTICE 'Job % Stage % Part %: part_barrier=%, sequential_barrier=%, final_barrier=%',
    p_job_id, p_current_stage_order, p_part_assignment, 
    part_barrier_time, sequential_barrier_time, final_barrier;

  RETURN final_barrier;
END;
$$;

-- 2. Update scheduler to use enhanced barrier calculation and add sequential tracking
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_sequential_enhanced(
  p_start_from timestamp with time zone DEFAULT NULL
) RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
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
  job_part_barriers jsonb := '{}'::jsonb;
  job_sequential_barrier timestamptz;
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  calculated_barrier timestamptz;
  barrier_key text;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 45);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting SEQUENTIAL-ENHANCED scheduler from: %', base_time;

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

  RAISE NOTICE 'Initialized % production stages with enhanced sequential logic', (SELECT COUNT(*) FROM _stage_tails);

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
    -- Initialize part barriers from actual completion times of completed stages
    SELECT jsonb_object_agg(
      COALESCE(jsi.part_assignment, 'main'),
      COALESCE(jsi.scheduled_end_at, jsi.completed_at, GREATEST(base_time, r_job.proof_approved_at))
    ) INTO job_part_barriers
    FROM job_stage_instances jsi
    WHERE jsi.job_id = r_job.job_id 
      AND jsi.status = 'completed'
      AND (jsi.scheduled_end_at IS NOT NULL OR jsi.completed_at IS NOT NULL);
    
    -- Initialize sequential barrier (when the last stage in this job ended)
    SELECT COALESCE(
      MAX(COALESCE(jsi.scheduled_end_at, jsi.completed_at)),
      GREATEST(base_time, r_job.proof_approved_at)
    ) INTO job_sequential_barrier
    FROM job_stage_instances jsi
    WHERE jsi.job_id = r_job.job_id 
      AND jsi.status = 'completed';
    
    -- Ensure all barrier keys exist with minimum values
    job_part_barriers := COALESCE(job_part_barriers, '{}'::jsonb);
    job_part_barriers := job_part_barriers 
      || jsonb_build_object('main', GREATEST(base_time, r_job.proof_approved_at));
    job_sequential_barrier := COALESCE(job_sequential_barrier, GREATEST(base_time, r_job.proof_approved_at));
    
    RAISE NOTICE 'Processing job % (WO: %) - part_barriers: %, sequential_barrier: %', 
      r_job.job_id, r_job.wo_no, job_part_barriers, job_sequential_barrier;
    
    -- Process stages grouped by stage_order for parallel stage support
    FOR r_stage_group IN
      SELECT 
        stage_order,
        array_agg(jsi.id ORDER BY jsi.id) as stage_instance_ids,
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
        -- Use enhanced barrier calculation that enforces BOTH part and sequential dependencies
        barrier_key := COALESCE(r_stage.part_assignment, 'main');
        calculated_barrier := public.calculate_job_completion_barrier(
          r_job.job_id, 
          r_stage.stage_order, 
          barrier_key
        );
        
        -- Ensure we don't schedule before proof approval or base time
        stage_earliest_start := GREATEST(
          calculated_barrier,
          job_sequential_barrier,
          COALESCE(r_job.proof_approved_at, base_time),
          base_time
        );

        -- Get resource availability
        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        -- Stage must wait for job barriers AND resource availability
        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        RAISE NOTICE 'Enhanced scheduling stage % (%): % mins from % (calculated_barrier=%, sequential_barrier=%, resource_avail=%)',
          r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
          stage_earliest_start, calculated_barrier, job_sequential_barrier, resource_available_time;

        -- Place the duration
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
        
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE EXCEPTION 'FAILED to schedule stage % (%) - placement failed at %',
            r_stage.stage_name, r_stage.stage_instance_id, stage_earliest_start;
        END IF;

        IF jsonb_array_length(placement_result.slots_created) = 0 THEN
          RAISE EXCEPTION 'FAILED to schedule stage % (%) - no slots created',
            r_stage.stage_name, r_stage.stage_instance_id;
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

        -- Update part-specific barrier
        job_part_barriers := jsonb_set(job_part_barriers, ARRAY[barrier_key], to_jsonb(stage_end_time));
        
        -- Update sequential barrier (CRITICAL: this ensures next stage waits for this one)
        job_sequential_barrier := GREATEST(job_sequential_barrier, stage_end_time);

        RAISE NOTICE 'Completed enhanced scheduling stage % - ends at % (part_barrier updated, sequential_barrier=%)',
          r_stage.stage_name, stage_end_time, job_sequential_barrier;
      END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Completed job % with enhanced sequential logic - final sequential_barrier: %', 
      r_job.job_id, job_sequential_barrier;
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

  RAISE NOTICE 'SEQUENTIAL-ENHANCED Scheduler complete: wrote % slots, updated % stages, found % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'SEQUENTIAL-ENHANCED Scheduler failed: %', SQLERRM;
END;
$$;