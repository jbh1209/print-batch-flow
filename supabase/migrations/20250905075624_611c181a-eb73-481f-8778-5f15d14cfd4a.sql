-- Fix scheduler to IGNORE completed stages entirely
-- Only process pending/active stages for scheduling

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_sequential_enhanced(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
  
  -- Scheduling variables
  resource_available_time timestamptz;
  job_completion_barrier timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 45);

  -- Determine base scheduling time
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  RAISE NOTICE 'Starting ENHANCED scheduler (IGNORING completed stages) from: %', base_time;

  -- Clear existing non-completed slots ONLY
  DELETE FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = false
    AND stage_instance_id IN (
      SELECT jsi.id 
      FROM job_stage_instances jsi
      WHERE COALESCE(jsi.status, '') NOT IN ('completed')
    );
  RAISE NOTICE 'Cleared existing non-completed time slots';

  -- Clear scheduling data for NON-COMPLETED stages only
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE COALESCE(status, '') NOT IN ('completed');
  
  RAISE NOTICE 'Cleared scheduling data from NON-COMPLETED job_stage_instances';

  -- Initialize stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize all stages to base time (only for non-completed stages)
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') NOT IN ('completed')
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- Also account for any existing completed slots to set proper resource availability
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    GREATEST(MAX(slot_end_time), base_time)
  FROM stage_time_slots
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  RAISE NOTICE 'Initialized % production stages', (SELECT COUNT(*) FROM _stage_tails);

  -- Process jobs in STRICT FIFO order by proof_approved_at (IGNORE COMPLETED STAGES)
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.proof_approved_at,
      pj.wo_no,
      COUNT(jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    WHERE COALESCE(jsi.status, '') NOT IN ('completed')  -- CRITICAL: IGNORE COMPLETED
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    -- SIMPLIFIED: Job barrier starts from base_time or proof approval (NO completed stage lookups)
    job_completion_barrier := GREATEST(base_time, COALESCE(r_job.proof_approved_at, base_time));
    
    RAISE NOTICE 'Processing job % (WO: %) with % NON-COMPLETED stages - job barrier starts at %', 
      r_job.job_id, r_job.wo_no, r_job.total_stages, job_completion_barrier;
    
    -- Process ONLY NON-COMPLETED stages in STRICT stage_order sequence
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
        AND COALESCE(jsi.status, '') NOT IN ('completed')  -- CRITICAL: IGNORE COMPLETED
      ORDER BY COALESCE(jsi.stage_order, 999999) ASC, jsi.id ASC
    LOOP
      -- Get resource availability for this production stage
      SELECT next_available_time INTO resource_available_time
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id
      FOR UPDATE;

      -- SIMPLIFIED: Stage cannot start until BOTH conditions are met:
      -- 1. The production stage/queue is available
      -- 2. Previous NON-COMPLETED stages in this job are completed (job_completion_barrier)
      stage_earliest_start := GREATEST(job_completion_barrier, resource_available_time);

      RAISE NOTICE 'Scheduling NON-COMPLETED stage % (%): % mins from % (job_barrier=%, resource_avail=%)',
        r_stage.stage_name, r_stage.stage_instance_id, r_stage.duration_minutes,
        stage_earliest_start, job_completion_barrier, resource_available_time;

      -- Place the duration using the corrected earliest start time
      SELECT * INTO placement_result
      FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
      
      IF placement_result.placement_success AND placement_result.slots_created IS NOT NULL THEN
        -- Validate slots_created is not empty
        IF jsonb_array_length(placement_result.slots_created) = 0 THEN
          RAISE WARNING 'No slots created for stage % (% minutes)', 
            r_stage.stage_instance_id, r_stage.duration_minutes;
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

        -- SIMPLIFIED: Update job completion barrier for next NON-COMPLETED stage
        job_completion_barrier := stage_end_time;

        RAISE NOTICE 'Completed scheduling NON-COMPLETED stage % - ends at % (new job barrier)', 
          r_stage.stage_name, stage_end_time;
      ELSE
        RAISE WARNING 'Failed to schedule NON-COMPLETED stage instance % (% minutes) - placement failed',
          r_stage.stage_instance_id, r_stage.duration_minutes;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed job % - final barrier at %', r_job.job_id, job_completion_barrier;
  END LOOP;

  -- POST-SCHEDULING VALIDATION: Check for precedence violations (ONLY NON-COMPLETED stages)
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

  RAISE NOTICE 'ENHANCED Scheduler (IGNORING completed) complete: wrote % slots, updated % stage instances, found % violations', 
    wrote_count, updated_count, jsonb_array_length(validation_results);

  wrote_slots := wrote_count;
  updated_jsi := updated_count;
  violations := validation_results;
  RETURN NEXT;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'ENHANCED Scheduler (IGNORING completed) failed: %', SQLERRM;
END;
$function$;