-- Enhanced scheduler function with parallel processing support
CREATE OR REPLACE FUNCTION scheduler_reschedule_all_parallel_aware(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql AS $$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  
  -- Job processing variables
  r_job record;
  r_stage_group record;
  r_stage record;
  
  -- Parallel processing variables
  job_stage_barriers jsonb := '{}'::jsonb;  -- Track completion per part/dependency group
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  max_barrier_time timestamptz;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 42);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting PARALLEL-AWARE scheduler from: %', base_time;

  -- Clear existing non-completed slots
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  RAISE NOTICE 'Cleared existing non-completed time slots';

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize all stages to base time
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') <> 'completed';

  RAISE NOTICE 'Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- Process jobs in FIFO order by proof_approved_at
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.proof_approved_at,
      pj.wo_no,
      COUNT(jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    WHERE COALESCE(jsi.status, '') <> 'completed'
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    -- Initialize job-level barriers for this job
    job_stage_barriers := jsonb_build_object(
      'main', GREATEST(base_time, r_job.proof_approved_at),
      'cover', GREATEST(base_time, r_job.proof_approved_at),
      'text', GREATEST(base_time, r_job.proof_approved_at)
    );
    
    RAISE NOTICE 'Processing job % (WO: %) with % stages - barriers initialized', 
      r_job.job_id, r_job.wo_no, r_job.total_stages;
    
    -- Process stages grouped by stage_order to handle parallel stages
    FOR r_stage_group IN
      SELECT 
        stage_order,
        array_agg(jsi.id) as stage_instance_ids,
        array_agg(DISTINCT jsi.part_assignment) FILTER (WHERE jsi.part_assignment IS NOT NULL) as parts_in_group,
        array_agg(DISTINCT jsi.dependency_group) FILTER (WHERE jsi.dependency_group IS NOT NULL) as dependency_groups_in_group,
        COUNT(*) as stages_in_group
      FROM job_stage_instances jsi
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') <> 'completed'
      GROUP BY stage_order
      ORDER BY stage_order ASC
    LOOP
      RAISE NOTICE 'Processing stage group order % with % stages (parts: %, deps: %)',
        r_stage_group.stage_order, r_stage_group.stages_in_group,
        r_stage_group.parts_in_group, r_stage_group.dependency_groups_in_group;
      
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
        ORDER BY jsi.id  -- Stable ordering within parallel group
      LOOP
        -- Determine the appropriate barrier for this stage
        IF r_stage.part_assignment IS NOT NULL THEN
          -- Part-specific barrier (cover/text)
          stage_earliest_start := GREATEST(
            (job_stage_barriers ->> 'main')::timestamptz,
            (job_stage_barriers ->> r_stage.part_assignment)::timestamptz
          );
        ELSIF r_stage.dependency_group IS NOT NULL THEN
          -- Dependency group barrier - wait for all previous stages in this dependency group
          SELECT COALESCE(MAX(scheduled_end_at), (job_stage_barriers ->> 'main')::timestamptz)
          INTO stage_earliest_start
          FROM job_stage_instances prev_jsi
          WHERE prev_jsi.job_id = r_job.job_id
            AND prev_jsi.dependency_group = r_stage.dependency_group
            AND prev_jsi.stage_order < r_stage.stage_order
            AND prev_jsi.scheduled_end_at IS NOT NULL;
          
          -- Fallback to main barrier if no previous stages in dependency group
          stage_earliest_start := COALESCE(stage_earliest_start, (job_stage_barriers ->> 'main')::timestamptz);
        ELSE
          -- Independent stage - use main barrier
          stage_earliest_start := (job_stage_barriers ->> 'main')::timestamptz;
        END IF;

        -- Get resource availability for this production stage
        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        -- Stage cannot start until BOTH conditions are met
        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        RAISE NOTICE 'Scheduling stage % (%) [%]: % mins from % (part: %, dep: %)',
          r_stage.stage_name, r_stage.stage_instance_id, r_stage.stage_order,
          r_stage.duration_minutes, stage_earliest_start, 
          COALESCE(r_stage.part_assignment, 'none'), 
          COALESCE(r_stage.dependency_group::text, 'none');

        -- Place the duration using the corrected earliest start time
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
        
        IF placement_result.placement_success AND placement_result.slots_created IS NOT NULL THEN
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

          -- Update resource availability for this production stage
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

          -- Update appropriate barrier
          IF r_stage.part_assignment IS NOT NULL THEN
            job_stage_barriers := jsonb_set(
              job_stage_barriers, 
              ARRAY[r_stage.part_assignment], 
              to_jsonb(stage_end_time)
            );
          END IF;

          RAISE NOTICE 'Completed scheduling stage % - ends at %', 
            r_stage.stage_name, stage_end_time;
        ELSE
          RAISE WARNING 'Failed to schedule stage instance % (% minutes) - placement failed',
            r_stage.stage_instance_id, r_stage.duration_minutes;
        END IF;
      END LOOP;
      
      -- After completing all stages in this parallel group, update main barrier
      -- to the maximum completion time of all stages in this group
      SELECT GREATEST(
        (job_stage_barriers ->> 'main')::timestamptz,
        COALESCE((job_stage_barriers ->> 'cover')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz),
        COALESCE((job_stage_barriers ->> 'text')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz)
      ) INTO max_barrier_time;
      
      job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY['main'], to_jsonb(max_barrier_time));
      
      RAISE NOTICE 'Completed stage group order % - main barrier updated to %', 
        r_stage_group.stage_order, max_barrier_time;
    END LOOP;
    
    RAISE NOTICE 'Completed job % - final barriers: %', r_job.job_id, job_stage_barriers;
  END LOOP;

  -- POST-SCHEDULING VALIDATION
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

  RAISE NOTICE 'PARALLEL-AWARE Scheduler complete: wrote % slots, updated % stage instances, found % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'PARALLEL-AWARE Scheduler failed: %', SQLERRM;
END;
$$;

-- Update the simple scheduler wrapper to use the new parallel-aware version
CREATE OR REPLACE FUNCTION simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all'::text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  result record;
  response jsonb;
BEGIN
  CASE p_mode
    WHEN 'reschedule_all' THEN
      SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware();
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'violations', result.violations,
        'mode', 'reschedule_all_parallel_aware'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  
  RETURN response;
END;
$$;