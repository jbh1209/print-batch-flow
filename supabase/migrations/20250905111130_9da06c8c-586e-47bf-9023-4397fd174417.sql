-- Create resource-optimized scheduler that fills shifts before moving to next day
CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized(p_start_from timestamp with time zone DEFAULT NULL)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  
  -- Processing variables
  r_stage record;
  available_time timestamptz;
  
  -- Scheduling variables
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  
  -- Job barriers for dependencies
  job_barriers jsonb := '{}'::jsonb;
  job_barrier timestamptz;
BEGIN
  -- Advisory lock
  PERFORM pg_advisory_xact_lock(1, 50);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting RESOURCE-OPTIMIZED scheduler from: %', base_time;

  -- Clear existing non-completed slots
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  
  -- Clear scheduling data for non-completed stages
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE COALESCE(status, '') NOT IN ('completed', 'active');
  
  RAISE NOTICE 'Cleared existing scheduling data';

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize resource availability from completed work
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    GREATEST(COALESCE(MAX(slot_end_time), base_time), base_time)
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- Initialize all production stages
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
  ON CONFLICT (stage_id) DO NOTHING;

  -- Initialize job barriers with proof approval times
  SELECT jsonb_object_agg(
    pj.id::text,
    GREATEST(base_time, COALESCE(pj.proof_approved_at, base_time))
  ) INTO job_barriers
  FROM production_jobs pj
  WHERE EXISTS (
    SELECT 1 FROM job_stage_instances jsi 
    WHERE jsi.job_id = pj.id AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
  );

  RAISE NOTICE 'Initialized % jobs with barriers', jsonb_object_keys(job_barriers)::text[];

  -- MAIN SCHEDULING LOOP: Process ready stages by resource availability
  LOOP
    -- Find next available resource and time
    SELECT stage_id, next_available_time INTO r_stage
    FROM _stage_tails 
    ORDER BY next_available_time ASC, stage_id ASC
    LIMIT 1;
    
    EXIT WHEN r_stage IS NULL;
    
    available_time := r_stage.next_available_time;
    
    -- Find ready stages for this resource at this time
    FOR r_stage IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.job_id,
        jsi.production_stage_id,
        jsi.stage_order,
        jsi.part_assignment,
        -- FIXED: Use scheduled_minutes first, then estimated_duration_minutes
        COALESCE(jsi.scheduled_minutes, jsi.estimated_duration_minutes, 60) as duration_minutes,
        ps.name as stage_name,
        pj.wo_no
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      JOIN production_jobs pj ON pj.id = jsi.job_id
      WHERE jsi.production_stage_id IN (
        -- Only consider resources that are available at available_time
        SELECT stage_id FROM _stage_tails WHERE next_available_time <= available_time + interval '1 minute'
      )
      AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      AND jsi.scheduled_start_at IS NULL
      -- Check job barrier (proof approval + previous stages)
      AND available_time >= COALESCE((job_barriers ->> jsi.job_id::text)::timestamptz, base_time)
      -- Check stage dependencies within job (previous stages completed)
      AND NOT EXISTS (
        SELECT 1 FROM job_stage_instances prev_jsi
        WHERE prev_jsi.job_id = jsi.job_id
          AND prev_jsi.stage_order < jsi.stage_order
          AND COALESCE(prev_jsi.status, '') NOT IN ('completed')
          AND prev_jsi.scheduled_end_at IS NULL
      )
      ORDER BY 
        -- Prioritize by resource availability, then job barriers, then stage order
        (SELECT next_available_time FROM _stage_tails WHERE stage_id = jsi.production_stage_id),
        COALESCE((job_barriers ->> jsi.job_id::text)::timestamptz, base_time),
        jsi.stage_order,
        jsi.job_id
      LIMIT 1 -- Process one stage at a time to fill resources optimally
    LOOP
      -- Get actual resource availability for this stage
      SELECT next_available_time INTO available_time
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id
      FOR UPDATE;

      -- Ensure we respect job barriers
      job_barrier := COALESCE((job_barriers ->> r_stage.job_id::text)::timestamptz, base_time);
      available_time := GREATEST(available_time, job_barrier);

      RAISE NOTICE 'Scheduling stage % (%): % mins from % (resource avail: %, job barrier: %)',
        r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
        available_time, (SELECT next_available_time FROM _stage_tails WHERE stage_id = r_stage.production_stage_id),
        job_barrier;

      -- Place the duration
      SELECT * INTO placement_result
      FROM public.place_duration_sql(available_time, r_stage.duration_minutes);
      
      IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
        RAISE WARNING 'Failed to place stage % - skipping', r_stage.stage_instance_id;
        CONTINUE;
      END IF;

      -- Create time slots
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
          r_stage.job_id,
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

      -- Update job barrier for this job's next stages
      job_barriers := jsonb_set(
        job_barriers, 
        ARRAY[r_stage.job_id::text], 
        to_jsonb(GREATEST(
          COALESCE((job_barriers ->> r_stage.job_id::text)::timestamptz, base_time),
          stage_end_time
        ))
      );

      RAISE NOTICE 'Completed stage % - ends at % (updated job barrier to %)', 
        r_stage.stage_name, stage_end_time, (job_barriers ->> r_stage.job_id::text);

      -- Exit inner loop to re-evaluate all resources
      EXIT;
    END LOOP;

    -- Check if we scheduled anything in this iteration
    IF NOT FOUND THEN
      -- No more schedulable stages - we're done
      EXIT;
    END IF;
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

  RAISE NOTICE 'RESOURCE-OPTIMIZED Scheduler complete: wrote % slots, updated % stages, % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'RESOURCE-OPTIMIZED Scheduler failed: %', SQLERRM;
END;
$function$;

-- Update the wrapper to use the resource-optimized scheduler
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
      -- Use the resource-optimized scheduler for maximum shift utilization
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