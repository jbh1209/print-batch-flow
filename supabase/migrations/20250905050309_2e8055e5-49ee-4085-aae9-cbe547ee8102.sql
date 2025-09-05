-- Fix scheduler and validation functions to exclude DTP and Proof stages
-- These stages should not be part of the post-approval scheduling workflow

-- Update the persistent queue scheduler to exclude DTP and Proof stages
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_persistent_queues(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  
  -- Job processing variables
  r_job record;
  r_stage_group record;
  r_stage record;
  
  -- Enhanced barrier and dependency tracking
  job_stage_barriers jsonb := '{}'::jsonb;
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  calculated_barrier timestamptz;
  barrier_key text;
  dependency_met boolean := true;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 44);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting PERSISTENT-QUEUE scheduler from: %', base_time;

  -- Clear existing non-completed slots (exclude DTP/Proof stages)
  DELETE FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = false
    AND stage_instance_id IN (
      SELECT jsi.id 
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE ps.name NOT ILIKE '%DTP%' AND ps.name NOT ILIKE '%proof%'
    );
  RAISE NOTICE 'Cleared existing non-completed time slots (excluding DTP/Proof stages)';

  -- Clear scheduling data for non-completed stages only (exclude DTP/Proof stages)
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE COALESCE(status, '') NOT IN ('completed', 'active')
    AND production_stage_id IN (
      SELECT ps.id 
      FROM production_stages ps 
      WHERE ps.name NOT ILIKE '%DTP%' AND ps.name NOT ILIKE '%proof%'
    );
  
  -- FIXED: Only use persistent queue system - no _stage_tails needed
  PERFORM public.initialize_queue_state();

  RAISE NOTICE 'Initialized persistent queue system with existing data';

  -- Process jobs in FIFO order by proof_approved_at (exclude DTP/Proof stages)
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.proof_approved_at,
      pj.wo_no,
      COUNT(jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      AND ps.name NOT ILIKE '%DTP%' AND ps.name NOT ILIKE '%proof%'
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    -- Initialize barriers from completed stages using enhanced calculation (exclude DTP/Proof)
    SELECT jsonb_object_agg(
      COALESCE(jsi.part_assignment, 'main'),
      public.get_actual_stage_end_time(jsi.id)
    ) INTO job_stage_barriers
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.job_id = r_job.job_id 
      AND jsi.status = 'completed'
      AND ps.name NOT ILIKE '%DTP%' AND ps.name NOT ILIKE '%proof%';
    
    -- Ensure all barrier keys exist with minimum values
    job_stage_barriers := COALESCE(job_stage_barriers, '{}'::jsonb);
    job_stage_barriers := job_stage_barriers 
      || jsonb_build_object('main', GREATEST(base_time, r_job.proof_approved_at));
    
    IF NOT (job_stage_barriers ? 'cover') THEN
      job_stage_barriers := job_stage_barriers || jsonb_build_object('cover', GREATEST(base_time, r_job.proof_approved_at));
    END IF;
    IF NOT (job_stage_barriers ? 'text') THEN
      job_stage_barriers := job_stage_barriers || jsonb_build_object('text', GREATEST(base_time, r_job.proof_approved_at));
    END IF;
    
    RAISE NOTICE 'Processing job % (WO: %) - persistent queue barriers: %', 
      r_job.job_id, r_job.wo_no, job_stage_barriers;
    
    -- Process stages grouped by stage_order for parallel stage support (exclude DTP/Proof)
    FOR r_stage_group IN
      SELECT 
        stage_order,
        array_agg(jsi.id ORDER BY jsi.id) as stage_instance_ids,
        array_agg(DISTINCT jsi.part_assignment) FILTER (WHERE jsi.part_assignment IS NOT NULL) as parts_in_group,
        array_agg(DISTINCT jsi.dependency_group) FILTER (WHERE jsi.dependency_group IS NOT NULL) as dependency_groups,
        COUNT(*) as stages_in_group
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
        AND ps.name NOT ILIKE '%DTP%' AND ps.name NOT ILIKE '%proof%'
      GROUP BY stage_order
      ORDER BY stage_order ASC
    LOOP
      RAISE NOTICE 'Processing parallel group order % with % stages (parts: %, deps: %)',
        r_stage_group.stage_order, r_stage_group.stages_in_group, 
        r_stage_group.parts_in_group, r_stage_group.dependency_groups;
      
      -- Process each stage in this parallel group (exclude DTP/Proof)
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
          AND ps.name NOT ILIKE '%DTP%' AND ps.name NOT ILIKE '%proof%'
        ORDER BY jsi.id
      LOOP
        -- Enhanced dependency validation (only for non-DTP/Proof stages)
        dependency_met := true;
        barrier_key := COALESCE(r_stage.part_assignment, 'main');
        
        -- Check if this stage has dependency group constraints
        IF r_stage.dependency_group IS NOT NULL THEN
          -- Check if all stages in same dependency group from previous orders are completed
          SELECT COUNT(*) = 0 INTO dependency_met
          FROM job_stage_instances prev_dep
          JOIN production_stages ps_dep ON ps_dep.id = prev_dep.production_stage_id
          WHERE prev_dep.job_id = r_job.job_id
            AND prev_dep.dependency_group = r_stage.dependency_group
            AND prev_dep.stage_order < r_stage.stage_order
            AND COALESCE(prev_dep.status, '') NOT IN ('completed', 'active')
            AND ps_dep.name NOT ILIKE '%DTP%' AND ps_dep.name NOT ILIKE '%proof%';
        END IF;
        
        IF NOT dependency_met THEN
          RAISE NOTICE 'Skipping stage % due to unmet dependency group constraints', r_stage.stage_name;
          CONTINUE;
        END IF;
        
        -- Calculate barrier using enhanced job completion barrier function
        calculated_barrier := public.calculate_job_completion_barrier(
          r_job.job_id, 
          r_stage.stage_order, 
          barrier_key
        );
        
        stage_earliest_start := GREATEST(
          calculated_barrier,
          COALESCE(r_job.proof_approved_at, base_time),
          base_time
        );

        -- Get resource availability from persistent queue
        SELECT COALESCE(psq.next_available_time, base_time) INTO resource_available_time
        FROM production_stage_queues psq
        WHERE psq.production_stage_id = r_stage.production_stage_id;

        -- Stage must wait for both job barrier and resource availability
        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        RAISE NOTICE 'Scheduling stage % with persistent queues: % mins from % (barrier: % = %)',
          r_stage.stage_name, r_stage.duration_minutes,
          stage_earliest_start, barrier_key, calculated_barrier;

        -- Place the duration using enhanced splitting logic
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

        -- Update persistent queue availability
        PERFORM public.update_stage_availability(
          r_stage.production_stage_id,
          stage_end_time,
          r_stage.duration_minutes
        );

        -- Add to queue positions for tracking
        INSERT INTO stage_queue_positions (
          production_stage_id, stage_instance_id, job_id, job_table_name,
          queue_position, estimated_start_time, estimated_end_time,
          duration_minutes, status
        )
        VALUES (
          r_stage.production_stage_id,
          r_stage.stage_instance_id,
          r_job.job_id,
          'production_jobs',
          (SELECT COALESCE(MAX(queue_position), 0) + 1 FROM stage_queue_positions WHERE production_stage_id = r_stage.production_stage_id),
          (SELECT MIN((time_slot ->> 'start_time')::timestamptz) FROM jsonb_array_elements(placement_result.slots_created) time_slot),
          stage_end_time,
          r_stage.duration_minutes,
          'queued'
        ) ON CONFLICT (stage_instance_id) DO UPDATE SET
          queue_position = EXCLUDED.queue_position,
          estimated_start_time = EXCLUDED.estimated_start_time,
          estimated_end_time = EXCLUDED.estimated_end_time,
          status = EXCLUDED.status,
          updated_at = now();

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

        RAISE NOTICE 'Completed persistent queue scheduling for stage % - ends at %',
          r_stage.stage_name, stage_end_time;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Enhanced validation with dependency checking (exclude DTP/Proof stages)
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

  RAISE NOTICE 'PERSISTENT-QUEUE Scheduler complete: wrote % slots, updated % stages, found % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'PERSISTENT-QUEUE Scheduler failed: %', SQLERRM;
END;
$function$;

-- Update the validation function to exclude DTP and Proof stages
CREATE OR REPLACE FUNCTION public.validate_job_scheduling_precedence(p_job_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(job_id uuid, violation_type text, stage1_name text, stage1_order integer, stage1_start timestamp with time zone, stage1_end timestamp with time zone, stage2_name text, stage2_order integer, stage2_start timestamp with time zone, stage2_end timestamp with time zone, violation_details text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH job_stage_slots AS (
    SELECT 
      jsi.job_id,
      jsi.stage_order,
      ps.name as stage_name,
      MIN(sts.slot_start_time) as earliest_start,
      MAX(sts.slot_end_time) as latest_end
    FROM job_stage_instances jsi
    JOIN production_stages ps ON jsi.production_stage_id = ps.id
    JOIN stage_time_slots sts ON sts.stage_instance_id = jsi.id
    WHERE (p_job_ids IS NULL OR jsi.job_id = ANY(p_job_ids))
      AND sts.slot_start_time IS NOT NULL
      AND sts.slot_end_time IS NOT NULL
      -- CRITICAL FIX: Exclude DTP and Proof stages from validation
      AND ps.name NOT ILIKE '%DTP%' AND ps.name NOT ILIKE '%proof%'
    GROUP BY jsi.job_id, jsi.stage_order, ps.name
  ),
  violations AS (
    SELECT 
      s1.job_id,
      'precedence_violation' as violation_type,
      s1.stage_name as stage1_name,
      s1.stage_order as stage1_order,
      s1.earliest_start as stage1_start,
      s1.latest_end as stage1_end,
      s2.stage_name as stage2_name,
      s2.stage_order as stage2_order,
      s2.earliest_start as stage2_start,
      s2.latest_end as stage2_end,
      format('Stage %s (order %s) starts at %s but depends on stage %s (order %s) which ends at %s',
             s2.stage_name, s2.stage_order, s2.earliest_start,
             s1.stage_name, s1.stage_order, s1.latest_end) as violation_details
    FROM job_stage_slots s1
    JOIN job_stage_slots s2 ON s1.job_id = s2.job_id
    WHERE s1.stage_order < s2.stage_order  -- s1 should complete before s2 starts
      AND s1.latest_end > s2.earliest_start  -- but s1 ends after s2 starts (violation!)
  )
  SELECT 
    v.job_id,
    v.violation_type,
    v.stage1_name,
    v.stage1_order,
    v.stage1_start,
    v.stage1_end,
    v.stage2_name,
    v.stage2_order,
    v.stage2_start,
    v.stage2_end,
    v.violation_details
  FROM violations v
  ORDER BY v.job_id, v.stage1_order, v.stage2_order;
END;
$function$;