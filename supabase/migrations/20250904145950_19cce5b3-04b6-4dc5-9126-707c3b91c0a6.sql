-- Problem #4: Update scheduler functions to use persistent queue system and Problem #5: Dependency Validation

-- Replace create_stage_availability_tracker to use persistent tables
CREATE OR REPLACE FUNCTION public.create_stage_availability_tracker()
RETURNS VOID
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Initialize queue state instead of creating temporary tables
  PERFORM public.initialize_queue_state();
END;
$function$;

-- Enhanced scheduler that uses persistent queues and better dependency validation
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
  prev_stage_end_times jsonb := '{}'::jsonb;
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

  -- Clear existing non-completed slots
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
  
  -- Initialize persistent queue system with current data
  PERFORM public.initialize_queue_state();

  RAISE NOTICE 'Initialized persistent queue system with existing data';

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
    -- Initialize barriers from completed stages using enhanced calculation
    SELECT jsonb_object_agg(
      COALESCE(jsi.part_assignment, 'main'),
      public.get_actual_stage_end_time(jsi.id)
    ) INTO job_stage_barriers
    FROM job_stage_instances jsi
    WHERE jsi.job_id = r_job.job_id 
      AND jsi.status = 'completed';
    
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
    
    -- Process stages grouped by stage_order for parallel stage support
    FOR r_stage_group IN
      SELECT 
        stage_order,
        array_agg(jsi.id ORDER BY jsi.id) as stage_instance_ids,
        array_agg(DISTINCT jsi.part_assignment) FILTER (WHERE jsi.part_assignment IS NOT NULL) as parts_in_group,
        array_agg(DISTINCT jsi.dependency_group) FILTER (WHERE jsi.dependency_group IS NOT NULL) as dependency_groups,
        COUNT(*) as stages_in_group
      FROM job_stage_instances jsi
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      GROUP BY stage_order
      ORDER BY stage_order ASC
    LOOP
      RAISE NOTICE 'Processing parallel group order % with % stages (parts: %, deps: %)',
        r_stage_group.stage_order, r_stage_group.stages_in_group, 
        r_stage_group.parts_in_group, r_stage_group.dependency_groups;
      
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
        -- Enhanced dependency validation
        dependency_met := true;
        barrier_key := COALESCE(r_stage.part_assignment, 'main');
        
        -- Check if this stage has dependency group constraints
        IF r_stage.dependency_group IS NOT NULL THEN
          -- Check if all stages in same dependency group from previous orders are completed
          SELECT COUNT(*) = 0 INTO dependency_met
          FROM job_stage_instances prev_dep
          WHERE prev_dep.job_id = r_job.job_id
            AND prev_dep.dependency_group = r_stage.dependency_group
            AND prev_dep.stage_order < r_stage.stage_order
            AND COALESCE(prev_dep.status, '') NOT IN ('completed', 'active');
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

  -- Enhanced validation with dependency checking
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

-- Enhanced place_duration_sql with better working hours and split logic (Problem #3)
CREATE OR REPLACE FUNCTION public.place_duration_sql_enhanced(
  p_earliest_start timestamp with time zone, 
  p_duration_minutes integer, 
  p_max_days integer DEFAULT 30
)
RETURNS TABLE(placement_success boolean, slots_created jsonb)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  current_day date;
  day_start timestamptz;
  day_end timestamptz;
  lunch_start timestamptz;
  lunch_end timestamptz;
  available_start timestamptz;
  remaining_minutes integer := p_duration_minutes;
  slots jsonb := '[]'::jsonb;
  day_count integer := 0;
  slot_start timestamptz;
  slot_end timestamptz;
  slot_duration integer;
  day_remaining_capacity integer;
  morning_capacity integer;
  afternoon_capacity integer;
  ss record;
BEGIN
  -- Validate inputs
  IF p_duration_minutes <= 0 THEN
    RETURN QUERY SELECT false, '[]'::jsonb;
    RETURN;
  END IF;

  -- Start from the earliest possible working moment
  available_start := public.next_working_start(p_earliest_start);
  current_day := available_start::date;

  WHILE remaining_minutes > 0 AND day_count < p_max_days LOOP
    day_count := day_count + 1;
    
    -- Skip non-working days
    IF NOT public.is_working_day(current_day) THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
      CONTINUE;
    END IF;

    -- Get enhanced shift information including lunch breaks
    SELECT 
      shift_start_time, shift_end_time, 
      lunch_break_start_time, lunch_break_duration_minutes,
      is_working_day
    INTO ss
    FROM shift_schedules 
    WHERE day_of_week = EXTRACT(dow FROM current_day)::int;
    
    IF ss IS NULL OR NOT ss.is_working_day THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
      CONTINUE;
    END IF;

    -- Calculate shift boundaries
    day_start := current_day::timestamptz + ss.shift_start_time;
    day_end := current_day::timestamptz + ss.shift_end_time;
    
    -- Handle lunch break if configured
    IF ss.lunch_break_start_time IS NOT NULL AND ss.lunch_break_duration_minutes > 0 THEN
      lunch_start := current_day::timestamptz + ss.lunch_break_start_time;
      lunch_end := lunch_start + make_interval(mins => ss.lunch_break_duration_minutes);
      
      -- Calculate available time around lunch
      slot_start := GREATEST(available_start, day_start);
      
      -- Morning slot before lunch
      IF slot_start < lunch_start THEN
        morning_capacity := EXTRACT(epoch FROM (lunch_start - slot_start)) / 60;
        IF morning_capacity > 0 THEN
          slot_duration := LEAST(remaining_minutes, morning_capacity::integer);
          slot_end := slot_start + make_interval(mins => slot_duration);
          
          slots := slots || jsonb_build_object(
            'start_time', slot_start,
            'end_time', slot_end,
            'duration_minutes', slot_duration,
            'date', current_day
          );
          
          remaining_minutes := remaining_minutes - slot_duration;
        END IF;
        
        -- Continue after lunch if more time needed
        IF remaining_minutes > 0 AND lunch_end < day_end THEN
          afternoon_capacity := EXTRACT(epoch FROM (day_end - lunch_end)) / 60;
          IF afternoon_capacity > 0 THEN
            slot_duration := LEAST(remaining_minutes, afternoon_capacity::integer);
            slot_end := lunch_end + make_interval(mins => slot_duration);
            
            slots := slots || jsonb_build_object(
              'start_time', lunch_end,
              'end_time', slot_end,
              'duration_minutes', slot_duration,
              'date', current_day
            );
            
            remaining_minutes := remaining_minutes - slot_duration;
          END IF;
        END IF;
      ELSE
        -- Start after lunch
        slot_start := GREATEST(available_start, lunch_end);
        IF slot_start < day_end THEN
          afternoon_capacity := EXTRACT(epoch FROM (day_end - slot_start)) / 60;
          IF afternoon_capacity > 0 THEN
            slot_duration := LEAST(remaining_minutes, afternoon_capacity::integer);
            slot_end := slot_start + make_interval(mins => slot_duration);
            
            slots := slots || jsonb_build_object(
              'start_time', slot_start,
              'end_time', slot_end,
              'duration_minutes', slot_duration,
              'date', current_day
            );
            
            remaining_minutes := remaining_minutes - slot_duration;
          END IF;
        END IF;
      END IF;
    ELSE
      -- No lunch break - simple placement
      slot_start := GREATEST(available_start, day_start);
      day_remaining_capacity := GREATEST(0, EXTRACT(epoch FROM (day_end - slot_start)) / 60)::integer;
      
      IF day_remaining_capacity > 0 THEN
        slot_duration := LEAST(remaining_minutes, day_remaining_capacity);
        slot_end := slot_start + make_interval(mins => slot_duration);
        
        slots := slots || jsonb_build_object(
          'start_time', slot_start,
          'end_time', slot_end,
          'duration_minutes', slot_duration,
          'date', current_day
        );
        
        remaining_minutes := remaining_minutes - slot_duration;
      END IF;
    END IF;
    
    -- Move to next day if more time needed
    IF remaining_minutes > 0 THEN
      current_day := current_day + 1;
      available_start := public.next_working_start(current_day::timestamptz);
    END IF;
  END LOOP;

  -- Return success if we placed all minutes within the day limit
  RETURN QUERY SELECT (remaining_minutes = 0), slots;
END;
$function$;

-- Update simple_scheduler_wrapper to use new persistent queue scheduler
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all'::text)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  result record;
  response jsonb;
BEGIN
  CASE p_mode
    WHEN 'reschedule_all' THEN
      -- Use the new persistent queue scheduler
      SELECT * INTO result FROM public.scheduler_reschedule_all_persistent_queues();
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'violations', result.violations,
        'mode', 'reschedule_all_persistent_queues'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  
  RETURN response;
END;
$function$;