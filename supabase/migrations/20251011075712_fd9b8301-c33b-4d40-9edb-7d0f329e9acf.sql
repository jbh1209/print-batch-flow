-- Fix find_available_gaps() calls and add stage sequencing validation to schedulers

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
  
  -- Gap-filling variables
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  days_saved numeric;
  earliest_possible_start timestamptz;
  v_lookback_days integer;
  v_days_back_to_prev numeric;
  predecessor_end timestamptz;
  later_stage_min_start timestamptz;
BEGIN
  base_time := public.next_working_start(now());
  
  RAISE NOTICE 'Starting append-only scheduler for % jobs from: %', array_length(p_job_ids, 1), base_time;

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

  -- PHASE 1: FIFO SEQUENTIAL SCHEDULING
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
    SELECT next_available_time INTO resource_available_time
    FROM _stage_tails 
    WHERE stage_id = r_stage.production_stage_id
    FOR UPDATE;

    resource_available_time := GREATEST(resource_available_time, r_stage.proof_approved_at, base_time);

    SELECT * INTO placement_result
    FROM public.place_duration_sql(resource_available_time, r_stage.duration_minutes, 60);
    
    IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
      RAISE EXCEPTION 'FAILED to append stage % for job % - placement failed at %',
        r_stage.stage_name, r_stage.job_id, resource_available_time;
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
        r_stage.job_id, 'production_jobs', r_stage.stage_instance_id, false
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
  END LOOP;

  -- PHASE 2: GAP-FILLING with stage sequencing validation
  RAISE NOTICE '🔀 Starting Phase 2: Gap-Filling (dynamic 7-90 day lookback, ≥0.25 day threshold)';
  
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
    WHERE jsi.job_id = ANY(p_job_ids)
      AND jsi.schedule_status = 'scheduled'
      AND ps.allow_gap_filling = true
      AND jsi.scheduled_minutes IS NOT NULL
      AND jsi.scheduled_minutes <= 120
      AND jsi.scheduled_start_at IS NOT NULL
    ORDER BY jsi.scheduled_start_at DESC
  LOOP
    original_start := gap_candidate.scheduled_start_at;
    
    SELECT MAX(jsi2.scheduled_end_at)
    INTO predecessor_end
    FROM job_stage_instances jsi2
    WHERE jsi2.job_id = gap_candidate.job_id
      AND jsi2.stage_order < gap_candidate.stage_order
      AND jsi2.scheduled_end_at IS NOT NULL;
    
    earliest_possible_start := COALESCE(predecessor_end, base_time);
    
    -- Check if any LATER stages in this job are already scheduled BEFORE current stage
    SELECT MIN(jsi3.scheduled_start_at)
    INTO later_stage_min_start
    FROM job_stage_instances jsi3
    WHERE jsi3.job_id = gap_candidate.job_id
      AND jsi3.stage_order > gap_candidate.stage_order
      AND jsi3.scheduled_start_at IS NOT NULL;
    
    -- If later stages exist and are scheduled before this stage, we have a sequencing problem
    -- Don't gap-fill if it would maintain or worsen this violation
    IF later_stage_min_start IS NOT NULL AND later_stage_min_start < original_start THEN
      RAISE NOTICE '⚠️ SKIP GAP-FILL: Stage % (WO: %) has later stages scheduled before it (% < %). This is a sequencing violation.',
        gap_candidate.stage_name, gap_candidate.wo_no, later_stage_min_start, original_start;
      CONTINUE;
    END IF;
    
    v_days_back_to_prev := EXTRACT(EPOCH FROM (original_start - earliest_possible_start)) / 86400.0;
    v_lookback_days := LEAST(90, GREATEST(7, FLOOR(v_days_back_to_prev)));
    
    -- FIXED: Call find_available_gaps with 5 parameters (added p_align_at)
    SELECT * INTO best_gap
    FROM find_available_gaps(
      gap_candidate.production_stage_id,
      gap_candidate.scheduled_minutes,
      original_start,
      v_lookback_days,
      earliest_possible_start  -- NEW: 5th parameter for precedence alignment
    )
    ORDER BY gap_start ASC
    LIMIT 1;
    
    IF best_gap IS NOT NULL AND best_gap.days_earlier >= 0.25 THEN
      -- Additional sequencing check: ensure gap-fill doesn't move stage AFTER any later stages
      IF later_stage_min_start IS NOT NULL AND best_gap.gap_start >= later_stage_min_start THEN
        RAISE NOTICE '⚠️ SKIP GAP-FILL: Gap at % would place stage % at or after later stages (% >= %)',
          best_gap.gap_start, gap_candidate.stage_name, best_gap.gap_start, later_stage_min_start;
        CONTINUE;
      END IF;
      
      days_saved := best_gap.days_earlier;
      
      RAISE NOTICE '🔀 GAP-FILLING: Moving stage % (WO: %) from % to % (saves %.2f days)',
        gap_candidate.stage_name, gap_candidate.wo_no, original_start, best_gap.gap_start, days_saved;
      
      DELETE FROM stage_time_slots 
      WHERE stage_instance_id = gap_candidate.stage_instance_id
        AND COALESCE(is_completed, false) = false;
      
      -- Use place_duration_sql for gap-filled placement
      SELECT * INTO placement_result
      FROM public.place_duration_sql(best_gap.gap_start, gap_candidate.scheduled_minutes, 60);
      
      IF placement_result.placement_success THEN
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
        
        SELECT MAX((time_slot ->> 'end_time')::timestamptz)
        INTO stage_end_time
        FROM jsonb_array_elements(placement_result.slots_created) time_slot;
        
        UPDATE job_stage_instances
        SET 
          scheduled_start_at = (
            SELECT MIN((time_slot ->> 'start_time')::timestamptz)
            FROM jsonb_array_elements(placement_result.slots_created) time_slot
          ),
          scheduled_end_at = stage_end_time,
          updated_at = now()
        WHERE id = gap_candidate.stage_instance_id;
        
        gap_filled_count := gap_filled_count + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Append scheduler complete: % initial slots, % gap-fills', wrote_count, gap_filled_count;
  
  RETURN QUERY SELECT wrote_count, updated_count, validation_results;
END;
$function$;

-- Also fix the reschedule_all function with same improvements
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(p_start_from timestamptz DEFAULT NULL)
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
  
  -- Gap-filling variables
  gap_candidate record;
  best_gap record;
  original_start timestamptz;
  days_saved numeric;
  earliest_possible_start timestamptz;
  v_lookback_days integer;
  v_days_back_to_prev numeric;
  predecessor_end timestamptz;
  later_stage_min_start timestamptz;
BEGIN
  base_time := COALESCE(p_start_from, public.next_working_start(now()));
  
  RAISE NOTICE '🚀 Starting full reschedule from: %', base_time;

  -- Nuclear reset: clear all non-completed slots
  DELETE FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = false;
  
  RAISE NOTICE '🗑️ Cleared all non-completed time slots';

  PERFORM public.create_stage_availability_tracker();
  
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE jsi.status IN ('pending', 'scheduled')
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- PHASE 1: FIFO SEQUENTIAL SCHEDULING
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
    WHERE pj.proof_approved_at IS NOT NULL
      AND jsi.status = 'pending'
    ORDER BY pj.proof_approved_at ASC, jsi.stage_order ASC
  LOOP
    SELECT next_available_time INTO resource_available_time
    FROM _stage_tails 
    WHERE stage_id = r_stage.production_stage_id
    FOR UPDATE;

    resource_available_time := GREATEST(resource_available_time, r_stage.proof_approved_at, base_time);

    SELECT * INTO placement_result
    FROM public.place_duration_sql(resource_available_time, r_stage.duration_minutes, 60);
    
    IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
      RAISE EXCEPTION 'FAILED to schedule stage % for job % - placement failed at %',
        r_stage.stage_name, r_stage.job_id, resource_available_time;
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
        r_stage.job_id, 'production_jobs', r_stage.stage_instance_id, false
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
  END LOOP;

  -- PHASE 2: GAP-FILLING with stage sequencing validation
  RAISE NOTICE '🔀 Starting Phase 2: Gap-Filling (dynamic 7-90 day lookback, ≥0.25 day threshold)';
  
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
    
    SELECT MAX(jsi2.scheduled_end_at)
    INTO predecessor_end
    FROM job_stage_instances jsi2
    WHERE jsi2.job_id = gap_candidate.job_id
      AND jsi2.stage_order < gap_candidate.stage_order
      AND jsi2.scheduled_end_at IS NOT NULL;
    
    earliest_possible_start := COALESCE(predecessor_end, base_time);
    
    -- Check if any LATER stages in this job are already scheduled BEFORE current stage
    SELECT MIN(jsi3.scheduled_start_at)
    INTO later_stage_min_start
    FROM job_stage_instances jsi3
    WHERE jsi3.job_id = gap_candidate.job_id
      AND jsi3.stage_order > gap_candidate.stage_order
      AND jsi3.scheduled_start_at IS NOT NULL;
    
    -- If later stages exist and are scheduled before this stage, we have a sequencing problem
    IF later_stage_min_start IS NOT NULL AND later_stage_min_start < original_start THEN
      RAISE NOTICE '⚠️ SKIP GAP-FILL: Stage % (WO: %) has later stages scheduled before it (% < %). Sequencing violation.',
        gap_candidate.stage_name, gap_candidate.wo_no, later_stage_min_start, original_start;
      CONTINUE;
    END IF;
    
    v_days_back_to_prev := EXTRACT(EPOCH FROM (original_start - earliest_possible_start)) / 86400.0;
    v_lookback_days := LEAST(90, GREATEST(7, FLOOR(v_days_back_to_prev)));
    
    -- FIXED: Call find_available_gaps with 5 parameters
    SELECT * INTO best_gap
    FROM find_available_gaps(
      gap_candidate.production_stage_id,
      gap_candidate.scheduled_minutes,
      original_start,
      v_lookback_days,
      earliest_possible_start  -- NEW: 5th parameter for precedence alignment
    )
    ORDER BY gap_start ASC
    LIMIT 1;
    
    IF best_gap IS NOT NULL AND best_gap.days_earlier >= 0.25 THEN
      -- Additional sequencing check
      IF later_stage_min_start IS NOT NULL AND best_gap.gap_start >= later_stage_min_start THEN
        RAISE NOTICE '⚠️ SKIP GAP-FILL: Gap at % would place stage % at or after later stages (% >= %)',
          best_gap.gap_start, gap_candidate.stage_name, best_gap.gap_start, later_stage_min_start;
        CONTINUE;
      END IF;
      
      days_saved := best_gap.days_earlier;
      
      RAISE NOTICE '🔀 GAP-FILLING: Moving stage % (WO: %) from % to % (saves %.2f days)',
        gap_candidate.stage_name, gap_candidate.wo_no, original_start, best_gap.gap_start, days_saved;
      
      DELETE FROM stage_time_slots 
      WHERE stage_instance_id = gap_candidate.stage_instance_id
        AND COALESCE(is_completed, false) = false;
      
      SELECT * INTO placement_result
      FROM public.place_duration_sql(best_gap.gap_start, gap_candidate.scheduled_minutes, 60);
      
      IF placement_result.placement_success THEN
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
        
        SELECT MAX((time_slot ->> 'end_time')::timestamptz)
        INTO stage_end_time
        FROM jsonb_array_elements(placement_result.slots_created) time_slot;
        
        UPDATE job_stage_instances
        SET 
          scheduled_start_at = (
            SELECT MIN((time_slot ->> 'start_time')::timestamptz)
            FROM jsonb_array_elements(placement_result.slots_created) time_slot
          ),
          scheduled_end_at = stage_end_time,
          updated_at = now()
        WHERE id = gap_candidate.stage_instance_id;
        
        gap_filled_count := gap_filled_count + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Full reschedule complete: % initial slots, % gap-fills', wrote_count, gap_filled_count;
  
  RETURN QUERY SELECT wrote_count, updated_count, validation_results;
END;
$function$;