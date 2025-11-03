-- Restore Oct 24 working parallel-aware scheduler (NO DIVISIONS, uses jsi_minutes)
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamp with time zone);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(text);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware();

-- Recreate from Oct 24 working version (migration 20250903101416)
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
  
  -- Parallel processing variables
  job_stage_barriers jsonb := '{}'::jsonb;
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
  
  -- Initialize stage tails based on existing slots
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    GREATEST(MAX(slot_end_time), base_time)
  FROM stage_time_slots
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- Ensure all relevant stages have entries
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') <> 'completed'
  ON CONFLICT (stage_id) DO NOTHING;

  RAISE NOTICE 'Initialized % production stages with proper queue tails', (SELECT COUNT(*) FROM _stage_tails);

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
    -- Initialize job-level barriers
    job_stage_barriers := jsonb_build_object(
      'main', GREATEST(base_time, r_job.proof_approved_at),
      'cover', GREATEST(base_time, r_job.proof_approved_at),
      'text', GREATEST(base_time, r_job.proof_approved_at)
    );
    
    RAISE NOTICE 'Processing job % (WO: %) with % stages', 
      r_job.job_id, r_job.wo_no, r_job.total_stages;
    
    -- Process stages grouped by stage_order
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
      -- Process each stage in parallel group
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
        -- Determine appropriate barrier
        IF r_stage.part_assignment IS NOT NULL THEN
          stage_earliest_start := GREATEST(
            (job_stage_barriers ->> 'main')::timestamptz,
            (job_stage_barriers ->> r_stage.part_assignment)::timestamptz
          );
        ELSIF r_stage.dependency_group IS NOT NULL THEN
          SELECT COALESCE(MAX(scheduled_end_at), (job_stage_barriers ->> 'main')::timestamptz)
          INTO stage_earliest_start
          FROM job_stage_instances prev_jsi
          WHERE prev_jsi.job_id = r_job.job_id
            AND prev_jsi.dependency_group = r_stage.dependency_group
            AND prev_jsi.stage_order < r_stage.stage_order
            AND prev_jsi.scheduled_end_at IS NOT NULL;
          
          stage_earliest_start := COALESCE(stage_earliest_start, (job_stage_barriers ->> 'main')::timestamptz);
        ELSE
          stage_earliest_start := (job_stage_barriers ->> 'main')::timestamptz;
        END IF;

        -- Get resource availability
        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        -- Place duration
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
        
        IF placement_result.placement_success AND placement_result.slots_created IS NOT NULL THEN
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

          -- Update barriers
          IF r_stage.part_assignment IS NOT NULL THEN
            job_stage_barriers := jsonb_set(
              job_stage_barriers, 
              ARRAY[r_stage.part_assignment], 
              to_jsonb(stage_end_time)
            );
          END IF;
        ELSE
          RAISE WARNING 'Failed to schedule stage instance % (% minutes)',
            r_stage.stage_instance_id, r_stage.duration_minutes;
        END IF;
      END LOOP;
      
      -- Update main barrier after parallel group
      SELECT GREATEST(
        (job_stage_barriers ->> 'main')::timestamptz,
        COALESCE((job_stage_barriers ->> 'cover')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz),
        COALESCE((job_stage_barriers ->> 'text')::timestamptz, (job_stage_barriers ->> 'main')::timestamptz)
      ) INTO max_barrier_time;
      
      job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY['main'], to_jsonb(max_barrier_time));
    END LOOP;
  END LOOP;

  -- Post-scheduling validation
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
$function$;

COMMENT ON FUNCTION public.scheduler_reschedule_all_parallel_aware(timestamp with time zone) IS 
  'Oct 24 working parallel-aware scheduler. Uses jsi_minutes() helper, NO divisions.';