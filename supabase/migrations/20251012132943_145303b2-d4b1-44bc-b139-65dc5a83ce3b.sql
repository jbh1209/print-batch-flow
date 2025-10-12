-- Fix scheduler_append_jobs to respect existing pending slots and prevent exact-time conflicts
-- This ensures new jobs append AFTER the true end of the resource queue, not just completed jobs

CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[],
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  
  r_job record;
  r_stage_group record;
  r_stage record;
  
  job_stage_barriers jsonb := '{}'::jsonb;
  completed_barriers jsonb;
  cover_barrier_time timestamptz;
  text_barrier_time timestamptz;
  main_barrier_time timestamptz;
  barrier_key text;
  
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  predecessor_end timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  stage_start_time timestamptz;
  
  -- Atomicity tracking per job
  job_inserted_slot_ids uuid[];
  job_updated_stage_ids uuid[];
  job_failed boolean;
  v_rows integer := 0;
  
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  earliest_possible_start timestamptz;
  v_lookback_days integer := 90;
  gap_filled_end timestamptz;
  days_saved numeric;
  v_existing_slots_count integer;
BEGIN
  base_time := public.next_working_start(date_trunc('day', now()) + interval '1 day');
  RAISE NOTICE '🚀 APPEND: Starting append for % jobs from base_time %', array_length(p_job_ids, 1), base_time;
  
  -- Create temp resource tracking
  PERFORM public.create_stage_availability_tracker();
  
  -- Compute completed barriers per job (from already completed slots)
  completed_barriers := (
    SELECT jsonb_object_agg(job_id::text,
      jsonb_build_object(
        'main', COALESCE(main_end, base_time),
        'cover', COALESCE(cover_end, base_time),
        'text', COALESCE(text_end, base_time),
        'both', COALESCE(both_end, base_time)
      )
    )
    FROM (
      SELECT
        jsi.job_id,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment = 'both') AS both_end,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('cover', 'both')) AS cover_end,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment IN ('text', 'both')) AS text_end,
        MAX(sts.slot_end_time) FILTER (WHERE jsi.part_assignment = 'both') AS main_end
      FROM stage_time_slots sts
      JOIN job_stage_instances jsi ON jsi.id = sts.stage_instance_id
      WHERE sts.is_completed = true
        AND jsi.job_id = ANY(p_job_ids)
      GROUP BY jsi.job_id
    ) s
  );
  
  -- ✅ FIX 1: Initialize resource availability from ALL future slots (completed + pending)
  -- This ensures new jobs append AFTER the true end of the resource queue
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    COALESCE(MAX(slot_end_time), base_time)
  FROM stage_time_slots 
  WHERE slot_end_time >= base_time  -- ✅ Changed from "is_completed = true"
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);
  
  -- Count existing slots for verification logging
  SELECT COUNT(*) INTO v_existing_slots_count
  FROM stage_time_slots
  WHERE slot_end_time >= base_time;
  
  RAISE NOTICE '📊 Resource availability initialized from % existing slots (completed + pending)', v_existing_slots_count;
  
  -- Ensure all production stages have an entry
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE jsi.job_id = ANY(p_job_ids)
  ON CONFLICT (stage_id) DO NOTHING;
  
  -- PHASE 1: ATOMIC FIFO SCHEDULING WITH PRECEDENCE AND BARRIERS
  RAISE NOTICE '📋 Phase 1: Atomic FIFO Scheduling with precedence...';
  
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.category_id
    FROM production_jobs pj
    WHERE pj.id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM job_stage_instances jsi 
        WHERE jsi.job_id = pj.id 
          AND jsi.status IN ('pending', 'active', 'on_hold')
          AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
      )
    ORDER BY pj.proof_approved_at ASC
  LOOP
    -- Reset atomicity tracking for this job
    job_inserted_slot_ids := ARRAY[]::uuid[];
    job_updated_stage_ids := ARRAY[]::uuid[];
    job_failed := false;
    
    -- Initialize barriers for this job
    job_stage_barriers := COALESCE(
      completed_barriers -> r_job.job_id::text,
      jsonb_build_object(
        'main', GREATEST(base_time, r_job.proof_approved_at),
        'cover', GREATEST(base_time, r_job.proof_approved_at),
        'text', GREATEST(base_time, r_job.proof_approved_at),
        'both', GREATEST(base_time, r_job.proof_approved_at)
      )
    );
    
    RAISE NOTICE '🔧 Job % (WO: %): Starting atomic scheduling', r_job.job_id, r_job.wo_no;
    
    -- Process stages in stage_order groups
    FOR r_stage_group IN
      SELECT 
        stage_order,
        array_agg(jsi.id) as stage_instance_ids
      FROM job_stage_instances jsi
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold')
        AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
      GROUP BY stage_order
      ORDER BY stage_order ASC
    LOOP
      FOR r_stage IN
        SELECT 
          jsi.id as stage_instance_id,
          jsi.production_stage_id,
          jsi.stage_order,
          jsi.part_assignment,
          jsi.status,
          public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes, jsi.remaining_minutes, jsi.completion_percentage) as duration_minutes,
          ps.name as stage_name
        FROM job_stage_instances jsi
        JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.id = ANY(r_stage_group.stage_instance_ids)
        ORDER BY jsi.id
      LOOP
        IF r_stage.duration_minutes IS NULL OR r_stage.duration_minutes <= 0 THEN
          RAISE WARNING '⚠️ INVALID DURATION for job % (WO: %), stage %: duration=% mins. ROLLING BACK JOB.', 
            r_job.job_id, r_job.wo_no, r_stage.stage_name, r_stage.duration_minutes;
          job_failed := true;
          EXIT; -- Exit stage loop
        END IF;
        
        -- Determine barrier key and compute earliest start from part barriers
        IF r_stage.part_assignment = 'both' THEN
          cover_barrier_time := COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          text_barrier_time := COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          main_barrier_time := COALESCE((job_stage_barriers->>'main')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          
          stage_earliest_start := GREATEST(cover_barrier_time, text_barrier_time, main_barrier_time);
          barrier_key := 'both';
        ELSE
          barrier_key := COALESCE(r_stage.part_assignment, 'main');
          
          IF NOT job_stage_barriers ? barrier_key THEN
            job_stage_barriers := jsonb_set(job_stage_barriers, ARRAY[barrier_key], to_jsonb(GREATEST(base_time, r_job.proof_approved_at)));
          END IF;
          
          stage_earliest_start := (job_stage_barriers ->> barrier_key)::timestamptz;
        END IF;
        
        -- Get resource availability
        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;
        
        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);
        
        -- CRITICAL: Enforce sequential stage order - wait for all predecessors
        SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
        FROM job_stage_instances jsi2
        WHERE jsi2.job_id = r_job.job_id
          AND jsi2.stage_order < r_stage.stage_order
          AND jsi2.scheduled_end_at IS NOT NULL;
        
        IF predecessor_end IS NOT NULL AND predecessor_end > stage_earliest_start THEN
          RAISE NOTICE '🔒 Job % stage % (order %): waiting for predecessor (barrier: %, pred_end: %)',
            r_job.wo_no, r_stage.stage_name, r_stage.stage_order, stage_earliest_start, predecessor_end;
          stage_earliest_start := predecessor_end;
        END IF;
        
        -- Place duration
        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes, 60);
        
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE WARNING '⚠️ FAILED to schedule stage % for job % (WO: %). ROLLING BACK JOB.', 
            r_stage.stage_name, r_job.job_id, r_job.wo_no;
          job_failed := true;
          EXIT; -- Exit stage loop
        END IF;
        
        -- Insert slots with conflict safety
        FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
        LOOP
          INSERT INTO stage_time_slots(
            production_stage_id, date, slot_start_time, slot_end_time,
            duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
          )
          VALUES (
            r_stage.production_stage_id,
            (slot_record ->> 'date')::date,
            (slot_record ->> 'start_time')::timestamptz,
            (slot_record ->> 'end_time')::timestamptz,
            (slot_record ->> 'duration_minutes')::integer,
            r_job.job_id, 'production_jobs', r_stage.stage_instance_id, false
          )
          ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING
          RETURNING id INTO slot_record;
          
          IF slot_record IS NOT NULL THEN
            job_inserted_slot_ids := array_append(job_inserted_slot_ids, (slot_record->>'id')::uuid);
            wrote_count := wrote_count + 1;
          ELSE
            RAISE NOTICE '⏭️ Append skipped conflicting slot: stage %, start %', 
              r_stage.production_stage_id, (slot_record->>'start_time')::timestamptz;
          END IF;
        END LOOP;
        
        -- Derive actual times from inserted rows
        SELECT MIN(slot_start_time), MAX(slot_end_time)
        INTO stage_start_time, stage_end_time
        FROM stage_time_slots
        WHERE stage_instance_id = r_stage.stage_instance_id
          AND COALESCE(is_completed, false) = false;
        
        IF stage_end_time IS NULL THEN
          RAISE WARNING '⚠️ No slots inserted for stage % (conflicts?). ROLLING BACK JOB.', r_stage.stage_instance_id;
          job_failed := true;
          EXIT;
        END IF;
        
        -- ✅ FIX 2: Update resource availability with 1-minute safety buffer
        -- This prevents exact-time conflicts on (production_stage_id, slot_start_time) UNIQUE constraint
        UPDATE _stage_tails 
        SET next_available_time = stage_end_time + interval '1 minute'
        WHERE stage_id = r_stage.production_stage_id;
        
        -- Update stage instance
        UPDATE job_stage_instances
        SET 
          scheduled_minutes = r_stage.duration_minutes,
          scheduled_start_at = stage_start_time,
          scheduled_end_at = stage_end_time,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = r_stage.stage_instance_id;
        
        updated_count := updated_count + 1;
        job_updated_stage_ids := array_append(job_updated_stage_ids, r_stage.stage_instance_id);
        
        -- Update barrier for this part assignment
        job_stage_barriers := jsonb_set(
          job_stage_barriers,
          ARRAY[barrier_key],
          to_jsonb(stage_end_time)
        );
        
        RAISE NOTICE '✅ Job % stage % scheduled: % to %', r_job.wo_no, r_stage.stage_name, stage_start_time, stage_end_time;
      END LOOP;
      
      -- Check if job failed during this stage group
      IF job_failed THEN
        EXIT; -- Exit stage_group loop
      END IF;
    END LOOP;
    
    -- ATOMICITY ENFORCEMENT: Rollback if job failed
    IF job_failed THEN
      RAISE WARNING '🔴 Job % (WO: %): ROLLING BACK - failed to schedule all stages atomically', r_job.job_id, r_job.wo_no;
      
      -- Delete inserted slots for this job
      IF array_length(job_inserted_slot_ids, 1) > 0 THEN
        DELETE FROM stage_time_slots
        WHERE id = ANY(job_inserted_slot_ids)
          AND COALESCE(is_completed, false) = false;
        
        wrote_count := wrote_count - array_length(job_inserted_slot_ids, 1);
      END IF;
      
      -- Revert stage instance updates
      IF array_length(job_updated_stage_ids, 1) > 0 THEN
        UPDATE job_stage_instances
        SET 
          scheduled_minutes = NULL,
          scheduled_start_at = NULL,
          scheduled_end_at = NULL,
          schedule_status = 'unscheduled',
          updated_at = now()
        WHERE id = ANY(job_updated_stage_ids);
        
        updated_count := updated_count - array_length(job_updated_stage_ids, 1);
      END IF;
      
      -- Log rollback
      INSERT INTO public.batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        r_job.job_id,
        r_job.wo_no,
        'append_jobs_ROLLBACK',
        format('Failed to schedule all stages atomically. Rolled back %s slots and %s stage updates.', 
          array_length(job_inserted_slot_ids, 1), array_length(job_updated_stage_ids, 1))
      );
    ELSE
      RAISE NOTICE '✅ Job % (WO: %): Successfully scheduled ALL stages atomically', r_job.job_id, r_job.wo_no;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Phase 1 complete: % slots written, % stages updated', wrote_count, updated_count;
  
  RETURN QUERY SELECT wrote_count, updated_count, validation_results;
END;
$$;