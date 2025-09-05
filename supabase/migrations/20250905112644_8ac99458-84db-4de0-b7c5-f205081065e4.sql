-- Fix malformed array literal error in scheduler_resource_fill_optimized
CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  
  -- Job processing variables
  r_job record;
  r_stage record;
  
  -- Resource optimization variables
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  
  -- Job barrier tracking (jsonb object: job_id -> completion_time)
  job_barriers jsonb := '{}'::jsonb;
  current_job_barrier timestamptz;
  
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 46);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting RESOURCE-FILL scheduler from: %', base_time;

  -- Clear existing non-completed slots and scheduling data
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE COALESCE(status, '') NOT IN ('completed', 'active');
  
  RAISE NOTICE 'Cleared non-completed scheduling data';

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize all stages to base time, accounting for existing completed work
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

  -- Initialize stages not yet tracked
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
  ON CONFLICT (stage_id) DO NOTHING;

  -- Initialize job barriers for all jobs with their minimum start times
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      GREATEST(base_time, COALESCE(pj.proof_approved_at, base_time)) as min_start_time
    FROM production_jobs pj
    WHERE EXISTS (
      SELECT 1 FROM job_stage_instances jsi 
      WHERE jsi.job_id = pj.id 
      AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
    )
  LOOP
    job_barriers := jsonb_set(job_barriers, ARRAY[r_job.job_id::text], to_jsonb(r_job.min_start_time));
  END LOOP;

  -- FIXED: Remove problematic logging statement that was causing malformed array error
  RAISE NOTICE 'Initialized % job barriers for resource optimization', jsonb_object_keys(job_barriers) IS NOT NULL;

  -- RESOURCE-OPTIMIZED SCHEDULING: Process stages by resource availability, not job sequence
  WHILE true LOOP
    -- Find the next available resource (earliest next_available_time)
    SELECT stage_id, next_available_time 
    INTO r_stage
    FROM _stage_tails 
    ORDER BY next_available_time ASC 
    LIMIT 1;
    
    IF r_stage.stage_id IS NULL THEN
      EXIT; -- No more resources to schedule
    END IF;
    
    -- Find the earliest ready stage for this resource
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.stage_order,
      COALESCE(jsi.scheduled_minutes, jsi.estimated_duration_minutes, 60) as duration_minutes,
      ps.name as stage_name,
      ps.has_dependencies
    INTO r_stage
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.production_stage_id = r_stage.stage_id
      AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      AND jsi.scheduled_start_at IS NULL
      -- DEPENDENCY CHECK: Stage can only run if previous stages in same job are completed
      AND (NOT COALESCE(ps.has_dependencies, true) OR NOT EXISTS (
        SELECT 1 FROM job_stage_instances prev_jsi
        WHERE prev_jsi.job_id = jsi.job_id
          AND COALESCE(prev_jsi.stage_order, 999) < COALESCE(jsi.stage_order, 999)
          AND COALESCE(prev_jsi.status, '') NOT IN ('completed', 'active')
      ))
    ORDER BY 
      -- Prioritize by job barrier time (earliest jobs first)
      (job_barriers ->> jsi.job_id::text)::timestamptz ASC,
      jsi.stage_order ASC,
      jsi.created_at ASC
    LIMIT 1;
    
    IF r_stage.stage_instance_id IS NULL THEN
      -- No ready stages for this resource, remove it from consideration
      DELETE FROM _stage_tails WHERE stage_id = r_stage.stage_id;
      CONTINUE;
    END IF;
    
    -- Get job barrier and resource availability
    current_job_barrier := (job_barriers ->> r_stage.job_id::text)::timestamptz;
    resource_available_time := (SELECT next_available_time FROM _stage_tails WHERE stage_id = r_stage.production_stage_id);
    
    -- Stage must wait for both job barrier and resource availability
    stage_earliest_start := GREATEST(current_job_barrier, resource_available_time);
    
    RAISE NOTICE 'RESOURCE-FILL: Scheduling % (job %) on resource % from % (barrier: %, resource: %)',
      r_stage.stage_name, r_stage.job_id, r_stage.production_stage_id, 
      stage_earliest_start, current_job_barrier, resource_available_time;
    
    -- Place the duration
    SELECT * INTO placement_result
    FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
    
    IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
      RAISE WARNING 'Failed to place stage % (% minutes) starting at %',
        r_stage.stage_instance_id, r_stage.duration_minutes, stage_earliest_start;
      -- Remove this resource to prevent infinite loop
      DELETE FROM _stage_tails WHERE stage_id = r_stage.production_stage_id;
      CONTINUE;
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
    
    -- Update job barrier: advance this job's completion time
    job_barriers := jsonb_set(job_barriers, ARRAY[r_stage.job_id::text], to_jsonb(stage_end_time));
    
    RAISE NOTICE 'RESOURCE-FILL: Completed % - resource available at %, job barrier at %',
      r_stage.stage_name, stage_end_time, stage_end_time;
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

  RAISE NOTICE 'RESOURCE-FILL Scheduler complete: wrote % slots, updated % instances, found % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'RESOURCE-FILL Scheduler failed: %', SQLERRM;
END;
$function$;