-- Fix the aggregate nesting issue in the truly sequential scheduler
CREATE OR REPLACE FUNCTION public.scheduler_truly_sequential_v2(p_start_from timestamp with time zone DEFAULT NULL)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  validation_count integer := 0;
  
  -- Job processing variables
  r_job record;
  r_stage record;
  
  -- Per-job processing
  job_start_time timestamptz;
  stage_start_time timestamptz;
  stage_end_time timestamptz;
  placement_result record;
  slot_record jsonb;
  
  -- Resource tracking
  stage_resource_times jsonb := '{}'::jsonb;
  resource_end_time timestamptz;
BEGIN
  -- Advisory lock
  PERFORM pg_advisory_xact_lock(1, 47);

  -- FIXED: Better null handling for base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(now() + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting TRULY SEQUENTIAL v2 scheduler from: %', base_time;

  -- Clear existing non-completed slots
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  
  -- Clear scheduling data for non-completed stages only
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE COALESCE(status, '') NOT IN ('completed', 'active');

  -- Initialize resource availability from completed work
  SELECT jsonb_object_agg(
    production_stage_id::text,
    GREATEST(
      COALESCE(MAX(slot_end_time), base_time),
      base_time
    )
  ) INTO stage_resource_times
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id;

  -- Ensure we have a base time for all stages
  stage_resource_times := COALESCE(stage_resource_times, '{}'::jsonb);

  RAISE NOTICE 'Initialized resource tracking with base time: %', base_time;

  -- Process jobs in strict FIFO order, completing each job entirely before moving to next
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
    ORDER BY COALESCE(pj.proof_approved_at, pj.created_at, now()) ASC, pj.id ASC
  LOOP
    -- FIXED: Better null handling for job start time
    job_start_time := GREATEST(base_time, COALESCE(r_job.proof_approved_at, base_time));
    
    RAISE NOTICE 'Processing job % (WO: %) with % stages - starting from %', 
      r_job.job_id, r_job.wo_no, r_job.total_stages, job_start_time;
    
    -- Process ALL stages of this job in strict stage_order sequence
    FOR r_stage IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.production_stage_id,
        jsi.stage_order,
        public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      ORDER BY COALESCE(jsi.stage_order, 999999) ASC, jsi.id ASC
    LOOP
      -- Get current resource availability
      resource_end_time := COALESCE(
        (stage_resource_times ->> r_stage.production_stage_id::text)::timestamptz,
        base_time
      );

      -- This stage must wait for BOTH:
      -- 1. The previous stage in this job to complete (job_start_time)
      -- 2. The resource to be available (resource_end_time)
      stage_start_time := GREATEST(job_start_time, resource_end_time);

      RAISE NOTICE 'Scheduling stage % (%): % mins from % (job_barrier=%, resource_avail=%)',
        r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
        stage_start_time, job_start_time, resource_end_time;

      -- Place the duration starting from stage_start_time
      SELECT * INTO placement_result
      FROM public.place_duration_sql(stage_start_time, r_stage.duration_minutes);
      
      IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
        RAISE EXCEPTION 'FAILED to schedule stage % (%) for job % - placement failed',
          r_stage.stage_name, r_stage.stage_instance_id, r_job.job_id;
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
          r_job.job_id,
          'production_jobs',
          r_stage.stage_instance_id,
          false
        );
        wrote_count := wrote_count + 1;
      END LOOP;

      -- Calculate when this stage ends
      SELECT MAX((time_slot ->> 'end_time')::timestamptz)
      INTO stage_end_time
      FROM jsonb_array_elements(placement_result.slots_created) time_slot;

      -- Update resource availability for this stage type
      stage_resource_times := jsonb_set(
        stage_resource_times, 
        ARRAY[r_stage.production_stage_id::text], 
        to_jsonb(stage_end_time)
      );

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

      -- CRITICAL: The next stage in THIS JOB must wait for this stage to complete
      job_start_time := stage_end_time;

      RAISE NOTICE 'Completed stage % - ends at % (next stage in job must wait until then)',
        r_stage.stage_name, stage_end_time;
    END LOOP;
    
    RAISE NOTICE 'Completed entire job % - final end time: %', r_job.job_id, job_start_time;
  END LOOP;

  -- FIXED: Simplified validation without nested aggregates
  SELECT COUNT(*) INTO validation_count
  FROM public.validate_job_scheduling_precedence() v;

  validation_results := jsonb_build_object(
    'violation_count', validation_count,
    'message', CASE 
      WHEN validation_count = 0 THEN 'No scheduling violations found'
      ELSE validation_count || ' scheduling violations detected'
    END
  );

  RAISE NOTICE 'TRULY SEQUENTIAL v2 complete: wrote % slots, updated % instances, % violations', 
    wrote_count, updated_count, validation_count;

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TRULY SEQUENTIAL v2 Scheduler failed: %', SQLERRM;
END;
$function$;