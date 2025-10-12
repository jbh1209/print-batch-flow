-- Make scheduler_append_jobs conflict-safe (critical day-to-day proof approval fix)
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[],
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  gap_filled_count integer := 0;
  
  r_job record;
  r_stage record;
  resource_available_time timestamptz;
  
  -- CHANGE 1: Add conflict-safety variables
  v_rows integer := 0;
  stage_start_time timestamptz;
  
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  days_saved numeric;
  earliest_possible_start timestamptz;
  v_lookback_days integer := 90;
BEGIN
  base_time := public.next_working_start(date_trunc('day', now()) + interval '1 day');
  RAISE NOTICE '🔄 Append-only scheduling for % jobs starting from: %', array_length(p_job_ids, 1), base_time;

  PERFORM public.create_stage_availability_tracker();

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
  WHERE jsi.job_id = ANY(p_job_ids)
  ON CONFLICT (stage_id) DO NOTHING;

  -- PHASE 1: FIFO SCHEDULING
  RAISE NOTICE '📋 Phase 1: FIFO Scheduling for specified jobs...';
  
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at
    FROM production_jobs pj
    WHERE pj.id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NOT NULL
    ORDER BY pj.proof_approved_at ASC
  LOOP
    FOR r_stage IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.job_id,
        jsi.production_stage_id,
        jsi.stage_order,
        jsi.status,
        jsi.schedule_status,
        public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes, jsi.remaining_minutes, jsi.completion_percentage) as duration_minutes,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND COALESCE(jsi.status, '') IN ('pending', 'active', 'on_hold')
      ORDER BY jsi.stage_order ASC
    LOOP
      IF p_only_if_unset AND r_stage.schedule_status = 'scheduled' THEN
        RAISE NOTICE '⏭️ Skipping already-scheduled stage % for job %', r_stage.stage_name, r_job.wo_no;
        CONTINUE;
      END IF;

      IF r_stage.duration_minutes IS NULL OR r_stage.duration_minutes <= 0 THEN
        RAISE WARNING '⚠️ INVALID DURATION for job % (WO: %), stage %: duration=% mins. Skipping.', 
          r_job.job_id, r_job.wo_no, r_stage.stage_name, r_stage.duration_minutes;
        CONTINUE;
      END IF;

      SELECT next_available_time INTO resource_available_time
      FROM _stage_tails 
      WHERE stage_id = r_stage.production_stage_id
      FOR UPDATE;

      stage_earliest_start := GREATEST(base_time, r_job.proof_approved_at, resource_available_time);

      SELECT * INTO placement_result
      FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes, 60);
      
      IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
        RAISE WARNING '⚠️ FAILED to schedule stage % for job %, skipping', r_stage.stage_name, r_job.job_id;
        CONTINUE;
      END IF;

      -- CHANGE 2: Make Phase 1 insertion conflict-safe
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
          r_stage.job_id, 'production_jobs', r_stage.stage_instance_id, false
        )
        ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING;
        
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows = 1 THEN
          wrote_count := wrote_count + 1;
        ELSE
          RAISE NOTICE '⏭️ Phase 1 skipped conflicting slot: stage %, start %', 
            r_stage.production_stage_id, (slot_record->>'start_time')::timestamptz;
        END IF;
      END LOOP;

      -- CHANGE 3: Derive times from actually inserted rows
      SELECT MIN(slot_start_time), MAX(slot_end_time)
      INTO stage_start_time, stage_end_time
      FROM stage_time_slots
      WHERE stage_instance_id = r_stage.stage_instance_id
        AND COALESCE(is_completed, false) = false;

      IF stage_end_time IS NULL THEN
        RAISE NOTICE '⏭️ No slots inserted for stage % (Phase 1), skipping updates', r_stage.stage_instance_id;
        CONTINUE;
      END IF;

      UPDATE _stage_tails 
      SET next_available_time = stage_end_time
      WHERE stage_id = r_stage.production_stage_id;

      UPDATE job_stage_instances
      SET 
        scheduled_minutes = r_stage.duration_minutes,
        scheduled_start_at = stage_start_time,
        scheduled_end_at = stage_end_time,
        schedule_status = 'scheduled',
        updated_at = now()
      WHERE id = r_stage.stage_instance_id;
      updated_count := updated_count + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ Phase 1 complete: % slots written, % stages scheduled', wrote_count, updated_count;

  -- PHASE 2: GAP-FILLING
  RAISE NOTICE '🔀 Phase 2: Gap-Filling for specified jobs...';
  
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
      pj.wo_no,
      COALESCE(
        (SELECT MAX(jsi2.scheduled_end_at)
         FROM job_stage_instances jsi2
         WHERE jsi2.job_id = jsi.job_id
           AND jsi2.stage_order < jsi.stage_order
           AND jsi2.scheduled_end_at IS NOT NULL),
        base_time
      ) as earliest_possible_start
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.job_id = ANY(p_job_ids)
      AND jsi.schedule_status = 'scheduled'
      AND ps.allow_gap_filling = true
      AND jsi.scheduled_minutes IS NOT NULL
      AND jsi.scheduled_minutes <= 120
      AND jsi.scheduled_start_at IS NOT NULL
    ORDER BY jsi.job_id, jsi.stage_order ASC, jsi.scheduled_start_at ASC
  LOOP
    original_start := gap_candidate.scheduled_start_at;
    earliest_possible_start := gap_candidate.earliest_possible_start;
    
    SELECT * INTO best_gap
    FROM find_available_gaps(
      gap_candidate.production_stage_id,
      gap_candidate.scheduled_minutes,
      original_start,
      v_lookback_days,
      earliest_possible_start
    )
    WHERE gap_start >= earliest_possible_start
    ORDER BY gap_start ASC
    LIMIT 1;
    
    IF best_gap IS NOT NULL 
       AND best_gap.gap_start >= earliest_possible_start 
       AND best_gap.gap_start < original_start THEN
      
      days_saved := EXTRACT(EPOCH FROM (original_start - best_gap.gap_start)) / 86400.0;
      
      RAISE NOTICE '🔀 GAP-FILLING: Moving stage % (WO: %, order %) from % to % (saves %.2f days)',
        gap_candidate.stage_name, gap_candidate.wo_no, gap_candidate.stage_order, 
        original_start, best_gap.gap_start, days_saved;
      
      DELETE FROM stage_time_slots 
      WHERE stage_instance_id = gap_candidate.stage_instance_id
        AND COALESCE(is_completed, false) = false;
      
      SELECT * INTO placement_result
      FROM public.place_duration_sql(
        best_gap.gap_start,
        gap_candidate.scheduled_minutes,
        60
      );
      
      IF placement_result.placement_success THEN
        -- CHANGE 4: Make Phase 2 insertion conflict-safe
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
          )
          ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING;
          
          GET DIAGNOSTICS v_rows = ROW_COUNT;
          IF v_rows = 0 THEN
            RAISE NOTICE '⏭️ Phase 2 skipped conflicting slot: stage %, start %', 
              gap_candidate.production_stage_id, (slot_record->>'start_time')::timestamptz;
          END IF;
        END LOOP;
        
        -- CHANGE 5: Derive gap-fill times from actual inserts
        SELECT MIN(slot_start_time), MAX(slot_end_time)
        INTO stage_start_time, stage_end_time
        FROM stage_time_slots
        WHERE stage_instance_id = gap_candidate.stage_instance_id
          AND COALESCE(is_completed, false) = false;
        
        IF stage_end_time IS NOT NULL THEN
          UPDATE job_stage_instances
          SET 
            scheduled_start_at = stage_start_time,
            scheduled_end_at = stage_end_time,
            updated_at = now()
          WHERE id = gap_candidate.stage_instance_id;
          
          INSERT INTO schedule_gap_fills(
            job_id, stage_instance_id, production_stage_id,
            original_scheduled_start, gap_filled_start, days_saved,
            minutes_saved, scheduler_run_type
          )
          VALUES (
            gap_candidate.job_id, gap_candidate.stage_instance_id, gap_candidate.production_stage_id,
            original_start, best_gap.gap_start, days_saved,
            (days_saved * 1440)::integer, 'append_jobs'
          );
          
          gap_filled_count := gap_filled_count + 1;
        ELSE
          RAISE WARNING '⚠️ Gap-fill resulted in no slots for stage % (WO: %)', gap_candidate.stage_name, gap_candidate.wo_no;
        END IF;
      ELSE
        RAISE WARNING '⚠️ Gap-fill placement failed for stage % (WO: %)', gap_candidate.stage_name, gap_candidate.wo_no;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Phase 2 complete: % stages gap-filled', gap_filled_count;
  RAISE NOTICE '📊 FINAL STATS: % total slots written, % stages updated, % gap-filled', wrote_count, updated_count, gap_filled_count;

  RETURN QUERY SELECT wrote_count, updated_count, validation_results;
END;
$function$;