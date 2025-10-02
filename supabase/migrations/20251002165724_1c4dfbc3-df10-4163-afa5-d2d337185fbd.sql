-- Enhance scheduler_append_jobs with Phase 2 gap-filling pass
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(p_job_ids uuid[], p_only_if_unset boolean DEFAULT true)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  gap_filled_count integer := 0;
  r_stage record;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  resource_available_time timestamptz;
  
  -- Phase 2: Gap-filling variables
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  days_saved numeric;
BEGIN
  -- Get factory base time for scheduling
  base_time := public.next_working_start(now());
  
  RAISE NOTICE 'Starting append-only scheduler for % jobs from: %', array_length(p_job_ids, 1), base_time;

  -- Create temporary stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize resource availability from existing completed slots
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    COALESCE(MAX(slot_end_time), base_time)
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- Initialize any untracked stages
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE jsi.job_id = ANY(p_job_ids)
  ON CONFLICT (stage_id) DO NOTHING;

  -- ========== PHASE 1: FIFO SEQUENTIAL SCHEDULING ==========
  -- Process pending stages for specified jobs in order
  FOR r_stage IN
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.stage_order,
      public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
      ps.name as stage_name,
      pj.proof_approved_at,
      pj.wo_no
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.job_id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NOT NULL
      AND jsi.status = 'pending'
      AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
    ORDER BY pj.proof_approved_at ASC, jsi.stage_order ASC
  LOOP
    RAISE NOTICE 'Appending stage % for job % (WO: %): % mins',
      r_stage.stage_name, r_stage.job_id, r_stage.wo_no, r_stage.duration_minutes;

    -- Get current resource availability
    SELECT next_available_time INTO resource_available_time
    FROM _stage_tails 
    WHERE stage_id = r_stage.production_stage_id
    FOR UPDATE;

    -- Schedule from resource availability or job approval time, whichever is later
    resource_available_time := GREATEST(resource_available_time, r_stage.proof_approved_at, base_time);

    -- Place duration starting from resource availability
    SELECT * INTO placement_result
    FROM public.place_duration_sql(resource_available_time, r_stage.duration_minutes, 60);
    
    IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
      RAISE EXCEPTION 'FAILED to append stage % for job % - placement failed at %',
        r_stage.stage_name, r_stage.job_id, resource_available_time;
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

    RAISE NOTICE 'Appended stage % - ends at %', r_stage.stage_name, stage_end_time;
  END LOOP;

  -- ========== PHASE 2: GAP-FILLING OPTIMIZATION PASS ==========
  RAISE NOTICE '🔀 Starting Phase 2: Gap-Filling Optimization Pass for appended jobs';
  
  -- Find all stages eligible for gap-filling (only from the jobs we just appended)
  FOR gap_candidate IN
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.scheduled_start_at,
      jsi.scheduled_end_at,
      jsi.scheduled_minutes,
      ps.name as stage_name,
      ps.allow_gap_filling
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.job_id = ANY(p_job_ids)
      AND jsi.schedule_status = 'scheduled'
      AND ps.allow_gap_filling = true
      AND jsi.scheduled_minutes IS NOT NULL
      AND jsi.scheduled_minutes <= 120
      AND jsi.scheduled_start_at IS NOT NULL
    ORDER BY jsi.scheduled_start_at DESC
  LOOP
    original_start := gap_candidate.scheduled_start_at;
    
    -- Find best gap (earliest available)
    SELECT * INTO best_gap
    FROM find_available_gaps(
      gap_candidate.production_stage_id,
      gap_candidate.scheduled_minutes,
      original_start,
      21 -- 21-day lookback
    )
    ORDER BY gap_start ASC
    LIMIT 1;
    
    -- Only move if found a gap AND it saves ≥1 day
    IF best_gap IS NOT NULL AND best_gap.days_earlier >= 1.0 THEN
      days_saved := best_gap.days_earlier;
      
      RAISE NOTICE '🔀 GAP-FILLING (append): Moving stage % from % to % (saves %.1f days)',
        gap_candidate.stage_name,
        original_start,
        best_gap.gap_start,
        days_saved;
      
      -- Delete old time slots
      DELETE FROM stage_time_slots 
      WHERE stage_instance_id = gap_candidate.stage_instance_id
        AND COALESCE(is_completed, false) = false;
      
      -- Create new gap-filled slot
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
        gap_candidate.production_stage_id,
        best_gap.gap_start::date,
        best_gap.gap_start,
        best_gap.gap_end,
        gap_candidate.scheduled_minutes,
        gap_candidate.job_id,
        'production_jobs',
        gap_candidate.stage_instance_id,
        false
      );
      
      -- Update job_stage_instances
      UPDATE job_stage_instances
      SET 
        scheduled_start_at = best_gap.gap_start,
        scheduled_end_at = best_gap.gap_end,
        updated_at = now()
      WHERE id = gap_candidate.stage_instance_id;
      
      -- Log the gap-fill
      INSERT INTO schedule_gap_fills(
        job_id,
        stage_instance_id,
        production_stage_id,
        original_scheduled_start,
        gap_filled_start,
        days_saved,
        minutes_saved,
        scheduler_run_type
      )
      VALUES (
        gap_candidate.job_id,
        gap_candidate.stage_instance_id,
        gap_candidate.production_stage_id,
        original_start,
        best_gap.gap_start,
        days_saved,
        (days_saved * 1440)::integer,
        'append'
      );
      
      gap_filled_count := gap_filled_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ Gap-filling complete for append: % stages moved to earlier time slots', gap_filled_count;

  -- Run validation
  SELECT jsonb_agg(to_jsonb(v)) INTO validation_results
  FROM public.validate_job_scheduling_precedence() v
  WHERE job_id = ANY(p_job_ids);

  RAISE NOTICE 'Append scheduler completed: % slots written, % stages updated, % gap-filled, % violations',
    wrote_count, updated_count, gap_filled_count, COALESCE(jsonb_array_length(validation_results), 0);

  RETURN QUERY SELECT wrote_count, updated_count, COALESCE(validation_results, '[]'::jsonb);
END;
$function$;