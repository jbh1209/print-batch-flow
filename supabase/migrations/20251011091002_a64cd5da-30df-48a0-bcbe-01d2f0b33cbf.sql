-- Rollback migration 20251011075712: Restore 4-parameter find_available_gaps() calls and remove RAISE EXCEPTION

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(p_start_from timestamptz DEFAULT NULL)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  gap_filled_count integer := 0;
  
  r_job record;
  r_stage_group record;
  r_stage record;
  
  job_stage_barriers jsonb := '{}'::jsonb;
  resource_available_time timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  
  completed_barriers jsonb;
  cover_barrier_time timestamptz;
  text_barrier_time timestamptz;
  main_barrier_time timestamptz;
  barrier_key text;
  
  -- Gap-filling variables
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  days_saved numeric;
  earliest_possible_start timestamptz;
  v_lookback_days integer;
  v_days_back_to_prev numeric;
  predecessor_end timestamptz;
  gap_filled_end timestamptz;
  
  expired_count integer := 0;
  on_hold_count integer := 0;
BEGIN
  -- Base time logic: tomorrow for manual runs, provided time for cron
  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now()) + interval '1 day');
    RAISE NOTICE '🔄 Manual reschedule starting from TOMORROW: %', base_time;
  ELSE
    base_time := public.next_working_start(p_start_from);
    RAISE NOTICE '🔄 Scheduled reschedule starting from: %', base_time;
  END IF;

  -- Clean up expired and on-hold stages
  DELETE FROM stage_time_slots
  WHERE COALESCE(is_completed, false) = false
    AND slot_start_time >= base_time;

  expired_count := (SELECT COUNT(*)::integer 
    FROM job_stage_instances 
    WHERE schedule_status IN ('scheduled', 'auto_held')
      AND scheduled_start_at < now() - interval '7 days');
  
  UPDATE job_stage_instances
  SET schedule_status = 'expired',
      scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = NULL,
      updated_at = now()
  WHERE schedule_status IN ('scheduled', 'auto_held')
    AND scheduled_start_at < now() - interval '7 days';

  on_hold_count := (SELECT COUNT(*)::integer 
    FROM job_stage_instances 
    WHERE status = 'on_hold');
  
  UPDATE job_stage_instances
  SET schedule_status = 'unscheduled',
      scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = NULL,
      updated_at = now()
  WHERE status IN ('pending', 'on_hold')
    AND schedule_status != 'expired';

  PERFORM public.create_stage_availability_tracker();

  -- Compute completed barriers per job
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
      GROUP BY jsi.job_id
    ) s
  );

  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    COALESCE(MAX(slot_end_time), base_time)
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  ON CONFLICT (stage_id) DO NOTHING;

  -- PHASE 1: FIFO SCHEDULING WITH PARALLEL BARRIERS
  RAISE NOTICE '📋 Phase 1: FIFO Scheduling starting...';
  
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.category_id
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM job_stage_instances jsi 
        WHERE jsi.job_id = pj.id 
          AND jsi.status IN ('pending', 'active', 'on_hold')
      )
    ORDER BY pj.proof_approved_at ASC
  LOOP
    job_stage_barriers := COALESCE(
      completed_barriers -> r_job.job_id::text,
      jsonb_build_object(
        'main', GREATEST(base_time, r_job.proof_approved_at),
        'cover', GREATEST(base_time, r_job.proof_approved_at),
        'text', GREATEST(base_time, r_job.proof_approved_at),
        'both', GREATEST(base_time, r_job.proof_approved_at)
      )
    );
    
    FOR r_stage_group IN
      SELECT 
        stage_order,
        array_agg(jsi.id) as stage_instance_ids
      FROM job_stage_instances jsi
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold')
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
          RAISE WARNING '⚠️ INVALID DURATION for job % (WO: %), stage %: duration=% mins. Skipping.', 
            r_job.job_id, r_job.wo_no, r_stage.stage_name, r_stage.duration_minutes;
          CONTINUE;
        END IF;
        
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

        SELECT next_available_time INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = r_stage.production_stage_id
        FOR UPDATE;

        stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

        SELECT * INTO placement_result
        FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes, 60);
        
        IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
          RAISE WARNING '⚠️ FAILED to schedule stage % for job %, skipping', r_stage.stage_name, r_job.job_id;
          CONTINUE;
        END IF;

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
          );
          wrote_count := wrote_count + 1;
        END LOOP;

        SELECT MAX((time_slot ->> 'end_time')::timestamptz)
        INTO stage_end_time
        FROM jsonb_array_elements(placement_result.slots_created) time_slot;

        UPDATE _stage_tails 
        SET next_available_time = stage_end_time
        WHERE stage_id = r_stage.production_stage_id;

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

        job_stage_barriers := jsonb_set(
          job_stage_barriers,
          ARRAY[barrier_key],
          to_jsonb(stage_end_time)
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ Phase 1 complete: % slots written, % stages scheduled', wrote_count, updated_count;

  -- PHASE 2: GAP-FILLING WITH place_duration_sql()
  RAISE NOTICE '🔀 Phase 2: Gap-Filling (using place_duration_sql for proper multi-day handling)';
  
  FOR gap_candidate IN
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.scheduled_start_at,
      jsi.scheduled_end_at,
      jsi.scheduled_minutes,
      jsi.stage_order,
      ps.name as stage_name,
      ps.allow_gap_filling,
      pj.wo_no
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.schedule_status = 'scheduled'
      AND ps.allow_gap_filling = true
      AND jsi.scheduled_minutes IS NOT NULL
      AND jsi.scheduled_minutes <= 120
      AND jsi.scheduled_start_at IS NOT NULL
    ORDER BY jsi.scheduled_start_at DESC
  LOOP
    original_start := gap_candidate.scheduled_start_at;
    
    -- Calculate earliest_possible_start from predecessor stages
    SELECT MAX(jsi2.scheduled_end_at)
    INTO predecessor_end
    FROM job_stage_instances jsi2
    WHERE jsi2.job_id = gap_candidate.job_id
      AND jsi2.stage_order < gap_candidate.stage_order
      AND jsi2.scheduled_end_at IS NOT NULL;
    
    earliest_possible_start := COALESCE(predecessor_end, base_time);
    
    -- Dynamic lookback: 7-90 days based on gap duration
    v_days_back_to_prev := EXTRACT(EPOCH FROM (original_start - earliest_possible_start)) / 86400.0;
    v_lookback_days := LEAST(90, GREATEST(7, FLOOR(v_days_back_to_prev)));
    
    SELECT * INTO best_gap
    FROM find_available_gaps(
      gap_candidate.production_stage_id,
      gap_candidate.scheduled_minutes,
      original_start,
      v_lookback_days
    )
    ORDER BY gap_start ASC
    LIMIT 1;
    
    -- Relaxed threshold: only ≥0.25 days (6 hours), NO UPPER CAP
    IF best_gap IS NOT NULL AND best_gap.days_earlier >= 0.25 THEN
      days_saved := best_gap.days_earlier;
      
      RAISE NOTICE '🔀 GAP-FILLING: Moving stage % (WO: %) from % to % (saves %.2f days)',
        gap_candidate.stage_name, gap_candidate.wo_no, original_start, best_gap.gap_start, days_saved;
      
      -- Delete old slots
      DELETE FROM stage_time_slots 
      WHERE stage_instance_id = gap_candidate.stage_instance_id
        AND COALESCE(is_completed, false) = false;
      
      -- Use place_duration_sql() to properly place the stage from the gap start
      SELECT * INTO placement_result
      FROM public.place_duration_sql(
        best_gap.gap_start,
        gap_candidate.scheduled_minutes,
        60
      );
      
      IF placement_result.placement_success THEN
        -- Create slots from the placement result (same as Phase 1)
        FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
        LOOP
          INSERT INTO stage_time_slots(
            production_stage_id, date, slot_start_time, slot_end_time,
            duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
          )
          VALUES (
            gap_candidate.production_stage_id,
            (slot_record ->> 'date')::date,
            (slot_record ->> 'start_time')::timestamptz,
            (slot_record ->> 'end_time')::timestamptz,
            (slot_record ->> 'duration_minutes')::integer,
            gap_candidate.job_id, 'production_jobs', gap_candidate.stage_instance_id, false
          );
        END LOOP;
        
        -- Calculate actual end time from all slots
        SELECT MAX((slot ->> 'end_time')::timestamptz)
        INTO gap_filled_end
        FROM jsonb_array_elements(placement_result.slots_created) slot;
        
        -- Update stage instance with proper start/end times
        UPDATE job_stage_instances
        SET 
          scheduled_start_at = (
            SELECT MIN((slot ->> 'start_time')::timestamptz)
            FROM jsonb_array_elements(placement_result.slots_created) slot
          ),
          scheduled_end_at = gap_filled_end,
          updated_at = now()
        WHERE id = gap_candidate.stage_instance_id;
        
        -- Log the gap fill
        INSERT INTO schedule_gap_fills(
          job_id, stage_instance_id, production_stage_id,
          original_scheduled_start, gap_filled_start, days_saved,
          minutes_saved, scheduler_run_type
        )
        VALUES (
          gap_candidate.job_id, gap_candidate.stage_instance_id, gap_candidate.production_stage_id,
          original_start, best_gap.gap_start, days_saved,
          (days_saved * 1440)::integer, 'reschedule_all'
        );
        
        gap_filled_count := gap_filled_count + 1;
      ELSE
        RAISE WARNING '⚠️ Gap-fill placement failed for stage % (WO: %)', gap_candidate.stage_name, gap_candidate.wo_no;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Phase 2 complete: % stages gap-filled', gap_filled_count;
  RAISE NOTICE '📊 FINAL STATS: % total slots written, % stages updated, % gap-filled', wrote_count, updated_count, gap_filled_count;

  RETURN QUERY SELECT wrote_count, updated_count, validation_results;
END;
$$;