-- ================================================================
-- RESTORE FRIDAY'S SCHEDULER + FIX RESCHEDULE-ALL HOLES
-- ================================================================
-- A) Restore Friday's full scheduler_append_jobs (part-aware, atomic, gap-filling)
-- B) Update scheduler_reschedule_all_parallel_aware with part-aware predecessor logic

-- ----------------------------------------------------------------
-- A) RESTORE FRIDAY'S FULL SCHEDULER_APPEND_JOBS
-- ----------------------------------------------------------------

-- 1. Drop all existing overloads
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(uuid[]);
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(uuid[], boolean);
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(uuid[], boolean, text);

-- 2. Install Friday's EXACT 2-argument implementation
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[],
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wrote_slots integer := 0;
  v_updated_jsi integer := 0;
  v_violations jsonb := '[]'::jsonb;
  
  r_job RECORD;
  r_stage RECORD;
  
  stage_earliest_start timestamptz;
  resource_available_time timestamptz;
  predecessor_end timestamptz;
  
  planned_intervals timestamptz[];
  slot_start timestamptz;
  slot_end timestamptz;
  new_slot_id uuid;
  
  v_stage_duration_minutes integer;
  v_resource_id uuid;
  
  -- Gap-filling Phase 2
  v_lookback_days integer := 90;
  v_max_move_minutes integer := 120;
  v_gap_fill_iterations integer := 3;
  iteration integer;
  gap_candidate RECORD;
  available_gaps RECORD;
  move_minutes integer;
  new_start timestamptz;
  new_end timestamptz;
  
  -- Per-job rollback tracking
  v_job_slots uuid[] := ARRAY[]::uuid[];
  v_job_error boolean := false;
BEGIN
  RAISE NOTICE '🔧 scheduler_append_jobs: Processing % jobs, only_if_unset=%', 
    array_length(p_job_ids, 1), p_only_if_unset;

  -- ============================================================
  -- PHASE 1: FIFO SCHEDULING WITH PART-AWARE PREDECESSORS
  -- ============================================================
  
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.category_id
    FROM production_jobs pj
    WHERE pj.id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NOT NULL
      AND pj.status NOT IN ('completed', 'cancelled')
    ORDER BY pj.proof_approved_at ASC, pj.created_at ASC
  LOOP
    RAISE NOTICE '📋 Processing job % (WO: %)', r_job.job_id, r_job.wo_no;
    
    v_job_slots := ARRAY[]::uuid[];
    v_job_error := false;
    
    -- Process stages for this job in order
    FOR r_stage IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.stage_order,
        ps.stage_name,
        ps.part_assignment,
        ps.default_resource_id,
        COALESCE(jsi.duration_minutes, ps.default_duration_minutes, 60) as duration_minutes
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.stage_id
      WHERE jsi.job_id = r_job.job_id
        AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
      ORDER BY jsi.stage_order ASC
    LOOP
      RAISE NOTICE '  📌 Stage % (order %, part=%): %min on resource %',
        r_stage.stage_name, r_stage.stage_order, 
        COALESCE(r_stage.part_assignment, 'main'),
        r_stage.duration_minutes, r_stage.default_resource_id;
      
      -- Calculate earliest start time
      stage_earliest_start := GREATEST(
        r_job.proof_approved_at,
        CURRENT_TIMESTAMP
      );
      
      -- Get resource availability
      SELECT COALESCE(MAX(sts.slot_end_time), stage_earliest_start)
      INTO resource_available_time
      FROM stage_time_slots sts
      WHERE sts.resource_id = r_stage.default_resource_id
        AND sts.slot_end_time > stage_earliest_start - interval '1 day';
      
      stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);
      
      -- CRITICAL: Enforce sequential stage order WITH PART-AWARE FILTERING
      SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
      FROM job_stage_instances jsi2
      WHERE jsi2.job_id = r_job.job_id
        AND jsi2.stage_order < r_stage.stage_order
        AND jsi2.scheduled_end_at IS NOT NULL
        AND (
          -- If current stage is 'both', wait for everything (convergence point)
          r_stage.part_assignment = 'both'
          OR
          -- If current stage is 'text', only wait for text and both stages
          (COALESCE(r_stage.part_assignment, 'main') = 'text' 
           AND jsi2.part_assignment IN ('text', 'both'))
          OR
          -- If current stage is 'cover', only wait for cover and both stages
          (COALESCE(r_stage.part_assignment, 'main') = 'cover' 
           AND jsi2.part_assignment IN ('cover', 'both'))
          OR
          -- If current stage is 'main' (or NULL), wait for main and both stages
          (COALESCE(r_stage.part_assignment, 'main') = 'main' 
           AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
        );
      
      IF predecessor_end IS NOT NULL AND predecessor_end > stage_earliest_start THEN
        RAISE NOTICE '  🔒 Waiting for %+both predecessor. New earliest: %',
          COALESCE(r_stage.part_assignment, 'main'), predecessor_end;
        stage_earliest_start := predecessor_end;
      END IF;
      
      -- Find working intervals
      BEGIN
        SELECT ARRAY(
          SELECT find_next_working_intervals(
            stage_earliest_start,
            r_stage.duration_minutes,
            60 -- 60 day horizon
          )
        ) INTO planned_intervals;
        
        IF array_length(planned_intervals, 1) IS NULL OR array_length(planned_intervals, 1) = 0 THEN
          RAISE WARNING '  ❌ No working intervals found for stage %', r_stage.stage_name;
          v_job_error := true;
          EXIT;
        END IF;
        
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '  ❌ Error finding intervals for stage %: %', r_stage.stage_name, SQLERRM;
        v_job_error := true;
        EXIT;
      END;
      
      slot_start := planned_intervals[1];
      slot_end := planned_intervals[array_length(planned_intervals, 1)];
      
      -- Create time slot
      BEGIN
        INSERT INTO stage_time_slots (
          resource_id,
          slot_start_time,
          slot_end_time,
          job_id,
          stage_instance_id
        ) VALUES (
          r_stage.default_resource_id,
          slot_start,
          slot_end,
          r_job.job_id,
          r_stage.stage_instance_id
        )
        RETURNING id INTO new_slot_id;
        
        v_job_slots := array_append(v_job_slots, new_slot_id);
        v_wrote_slots := v_wrote_slots + 1;
        
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '  ❌ Error creating time slot for stage %: %', r_stage.stage_name, SQLERRM;
        v_job_error := true;
        EXIT;
      END;
      
      -- Update stage instance
      BEGIN
        UPDATE job_stage_instances
        SET 
          scheduled_start_at = slot_start,
          scheduled_end_at = slot_end,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = r_stage.stage_instance_id;
        
        v_updated_jsi := v_updated_jsi + 1;
        
        RAISE NOTICE '  ✅ Scheduled: % to %', slot_start, slot_end;
        
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '  ❌ Error updating stage instance %: %', r_stage.stage_instance_id, SQLERRM;
        v_job_error := true;
        EXIT;
      END;
      
    END LOOP; -- stages
    
    -- Per-job atomicity: Rollback this job's slots if any stage failed
    IF v_job_error THEN
      RAISE WARNING '🔄 Rolling back % slots for job % due to error', 
        array_length(v_job_slots, 1), r_job.job_id;
      
      DELETE FROM stage_time_slots WHERE id = ANY(v_job_slots);
      v_wrote_slots := v_wrote_slots - array_length(v_job_slots, 1);
      
      UPDATE job_stage_instances
      SET 
        scheduled_start_at = NULL,
        scheduled_end_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE job_id = r_job.job_id
        AND id IN (
          SELECT stage_instance_id 
          FROM stage_time_slots 
          WHERE id = ANY(v_job_slots)
        );
    END IF;
    
  END LOOP; -- jobs

  -- ============================================================
  -- PHASE 2: GAP-FILLING (Move finishing stages forward)
  -- ============================================================
  
  RAISE NOTICE '🔍 Phase 2: Gap-filling with lookback=%d days, max_move=%d min, iterations=%',
    v_lookback_days, v_max_move_minutes, v_gap_fill_iterations;
  
  FOR iteration IN 1..v_gap_fill_iterations LOOP
    RAISE NOTICE '  🔄 Gap-fill iteration %/%', iteration, v_gap_fill_iterations;
    
    FOR gap_candidate IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.job_id,
        jsi.stage_order,
        jsi.scheduled_start_at,
        jsi.scheduled_end_at,
        ps.stage_name,
        ps.part_assignment,
        ps.default_resource_id,
        COALESCE(jsi.duration_minutes, ps.default_duration_minutes, 60) as duration_minutes,
        EXTRACT(EPOCH FROM (jsi.scheduled_end_at - jsi.scheduled_start_at))/60 as actual_duration
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.stage_id
      WHERE jsi.job_id = ANY(p_job_ids)
        AND jsi.scheduled_start_at IS NOT NULL
        AND jsi.scheduled_end_at IS NOT NULL
        AND ps.allow_gap_filling = true
        AND jsi.scheduled_start_at > CURRENT_TIMESTAMP + interval '1 day'
      ORDER BY jsi.scheduled_start_at ASC
    LOOP
      -- Check part-aware predecessors
      SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
      FROM job_stage_instances jsi2
      WHERE jsi2.job_id = gap_candidate.job_id
        AND jsi2.stage_order < gap_candidate.stage_order
        AND jsi2.scheduled_end_at IS NOT NULL
        AND (
          gap_candidate.part_assignment = 'both'
          OR
          (COALESCE(gap_candidate.part_assignment, 'main') = 'text' 
           AND jsi2.part_assignment IN ('text', 'both'))
          OR
          (COALESCE(gap_candidate.part_assignment, 'main') = 'cover' 
           AND jsi2.part_assignment IN ('cover', 'both'))
          OR
          (COALESCE(gap_candidate.part_assignment, 'main') = 'main' 
           AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
        );
      
      -- Find available gaps
      FOR available_gaps IN
        SELECT 
          gap_start,
          gap_end,
          gap_minutes
        FROM find_available_gaps(
          gap_candidate.default_resource_id,
          COALESCE(predecessor_end, CURRENT_TIMESTAMP),
          gap_candidate.scheduled_start_at,
          gap_candidate.duration_minutes
        )
        WHERE gap_minutes >= gap_candidate.duration_minutes
        ORDER BY gap_start ASC
        LIMIT 1
      LOOP
        move_minutes := EXTRACT(EPOCH FROM (gap_candidate.scheduled_start_at - available_gaps.gap_start))/60;
        
        IF move_minutes > v_max_move_minutes THEN
          RAISE NOTICE '    ⏭️  Skip % (would move %min > %min cap)',
            gap_candidate.stage_name, move_minutes, v_max_move_minutes;
          CONTINUE;
        END IF;
        
        new_start := available_gaps.gap_start;
        new_end := available_gaps.gap_start + (gap_candidate.scheduled_end_at - gap_candidate.scheduled_start_at);
        
        RAISE NOTICE '    ⬆️  Move % forward %min: % -> %',
          gap_candidate.stage_name, move_minutes, gap_candidate.scheduled_start_at, new_start;
        
        -- Update slot
        UPDATE stage_time_slots
        SET 
          slot_start_time = new_start,
          slot_end_time = new_end
        WHERE stage_instance_id = gap_candidate.stage_instance_id;
        
        -- Update stage instance
        UPDATE job_stage_instances
        SET 
          scheduled_start_at = new_start,
          scheduled_end_at = new_end,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = gap_candidate.stage_instance_id;
        
      END LOOP; -- available gaps
      
    END LOOP; -- gap candidates
    
  END LOOP; -- iterations

  RAISE NOTICE '✅ scheduler_append_jobs complete: wrote_slots=%, updated_jsi=%',
    v_wrote_slots, v_updated_jsi;

  RETURN QUERY SELECT v_wrote_slots, v_updated_jsi, v_violations;
END;
$$;

-- 3. Add explicit 1-argument wrapper (eliminates ambiguity)
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(p_job_ids uuid[])
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.scheduler_append_jobs(p_job_ids, true);
END;
$$;

-- 4. Re-add 3-argument wrapper (division compatibility)
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[],
  p_only_if_unset boolean,
  p_division text
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.scheduler_append_jobs(p_job_ids, p_only_if_unset);
END;
$$;

-- ----------------------------------------------------------------
-- B) UPDATE RESCHEDULE-ALL WITH PART-AWARE PREDECESSOR LOGIC
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wrote_slots integer := 0;
  v_updated_jsi integer := 0;
  v_violations jsonb := '[]'::jsonb;
  
  r_job RECORD;
  r_stage RECORD;
  
  stage_earliest_start timestamptz;
  resource_available_time timestamptz;
  predecessor_end timestamptz;
  
  planned_intervals timestamptz[];
  slot_start timestamptz;
  slot_end timestamptz;
  new_slot_id uuid;
  
  -- Gap-filling Phase 2
  v_lookback_days integer;
  v_max_move_minutes integer := 999999; -- No cap for gap-filling stages
  v_gap_fill_iterations integer := 3;
  iteration integer;
  gap_candidate RECORD;
  available_gaps RECORD;
  move_minutes integer;
  new_start timestamptz;
  new_end timestamptz;
  v_earliest_job_date timestamptz;
  v_latest_job_date timestamptz;
  v_job_span_days numeric;
BEGIN
  RAISE NOTICE '🚀 scheduler_reschedule_all_parallel_aware: start_from=%', p_start_from;

  -- Dynamic lookback calculation
  SELECT 
    MIN(proof_approved_at),
    MAX(proof_approved_at)
  INTO v_earliest_job_date, v_latest_job_date
  FROM production_jobs
  WHERE proof_approved_at IS NOT NULL
    AND status NOT IN ('completed', 'cancelled');
  
  v_job_span_days := EXTRACT(EPOCH FROM (v_latest_job_date - v_earliest_job_date))/(60*60*24);
  v_lookback_days := GREATEST(7, LEAST(90, CEIL(v_job_span_days * 1.5)));
  
  RAISE NOTICE '📊 Job span: %d days, using lookback: %d days', v_job_span_days, v_lookback_days;

  -- ============================================================
  -- PHASE 1: FIFO SCHEDULING WITH PART-AWARE PREDECESSORS
  -- ============================================================
  
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.category_id
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
      AND pj.status NOT IN ('completed', 'cancelled')
    ORDER BY pj.proof_approved_at ASC, pj.created_at ASC
  LOOP
    FOR r_stage IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.stage_order,
        ps.stage_name,
        ps.part_assignment,
        ps.default_resource_id,
        COALESCE(jsi.duration_minutes, ps.default_duration_minutes, 60) as duration_minutes
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.stage_id
      WHERE jsi.job_id = r_job.job_id
      ORDER BY jsi.stage_order ASC
    LOOP
      stage_earliest_start := GREATEST(
        COALESCE(p_start_from, r_job.proof_approved_at),
        CURRENT_TIMESTAMP
      );
      
      SELECT COALESCE(MAX(sts.slot_end_time), stage_earliest_start)
      INTO resource_available_time
      FROM stage_time_slots sts
      WHERE sts.resource_id = r_stage.default_resource_id
        AND sts.slot_end_time > stage_earliest_start - interval '1 day';
      
      stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);
      
      -- CRITICAL: Part-aware predecessor enforcement
      SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
      FROM job_stage_instances jsi2
      WHERE jsi2.job_id = r_job.job_id
        AND jsi2.stage_order < r_stage.stage_order
        AND jsi2.scheduled_end_at IS NOT NULL
        AND (
          r_stage.part_assignment = 'both'
          OR
          (COALESCE(r_stage.part_assignment, 'main') = 'text' 
           AND jsi2.part_assignment IN ('text', 'both'))
          OR
          (COALESCE(r_stage.part_assignment, 'main') = 'cover' 
           AND jsi2.part_assignment IN ('cover', 'both'))
          OR
          (COALESCE(r_stage.part_assignment, 'main') = 'main' 
           AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
        );
      
      IF predecessor_end IS NOT NULL AND predecessor_end > stage_earliest_start THEN
        stage_earliest_start := predecessor_end;
      END IF;
      
      SELECT ARRAY(
        SELECT find_next_working_intervals(
          stage_earliest_start,
          r_stage.duration_minutes,
          60
        )
      ) INTO planned_intervals;
      
      IF array_length(planned_intervals, 1) IS NULL OR array_length(planned_intervals, 1) = 0 THEN
        CONTINUE;
      END IF;
      
      slot_start := planned_intervals[1];
      slot_end := planned_intervals[array_length(planned_intervals, 1)];
      
      INSERT INTO stage_time_slots (
        resource_id,
        slot_start_time,
        slot_end_time,
        job_id,
        stage_instance_id
      ) VALUES (
        r_stage.default_resource_id,
        slot_start,
        slot_end,
        r_job.job_id,
        r_stage.stage_instance_id
      )
      RETURNING id INTO new_slot_id;
      
      v_wrote_slots := v_wrote_slots + 1;
      
      UPDATE job_stage_instances
      SET 
        scheduled_start_at = slot_start,
        scheduled_end_at = slot_end,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = r_stage.stage_instance_id;
      
      v_updated_jsi := v_updated_jsi + 1;
      
    END LOOP;
  END LOOP;

  -- ============================================================
  -- PHASE 2: GAP-FILLING WITH PART-AWARE PREDECESSORS
  -- ============================================================
  
  RAISE NOTICE '🔍 Phase 2: Gap-filling (lookback=%d days, no move cap)', v_lookback_days;
  
  FOR iteration IN 1..v_gap_fill_iterations LOOP
    FOR gap_candidate IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.job_id,
        jsi.stage_order,
        jsi.scheduled_start_at,
        jsi.scheduled_end_at,
        ps.stage_name,
        ps.part_assignment,
        ps.default_resource_id,
        COALESCE(jsi.duration_minutes, ps.default_duration_minutes, 60) as duration_minutes
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.stage_id
      WHERE jsi.scheduled_start_at IS NOT NULL
        AND jsi.scheduled_end_at IS NOT NULL
        AND ps.allow_gap_filling = true
        AND jsi.scheduled_start_at > CURRENT_TIMESTAMP + interval '1 day'
      ORDER BY jsi.scheduled_start_at ASC
    LOOP
      -- Part-aware predecessor check
      SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
      FROM job_stage_instances jsi2
      WHERE jsi2.job_id = gap_candidate.job_id
        AND jsi2.stage_order < gap_candidate.stage_order
        AND jsi2.scheduled_end_at IS NOT NULL
        AND (
          gap_candidate.part_assignment = 'both'
          OR
          (COALESCE(gap_candidate.part_assignment, 'main') = 'text' 
           AND jsi2.part_assignment IN ('text', 'both'))
          OR
          (COALESCE(gap_candidate.part_assignment, 'main') = 'cover' 
           AND jsi2.part_assignment IN ('cover', 'both'))
          OR
          (COALESCE(gap_candidate.part_assignment, 'main') = 'main' 
           AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
        );
      
      FOR available_gaps IN
        SELECT 
          gap_start,
          gap_end,
          gap_minutes
        FROM find_available_gaps(
          gap_candidate.default_resource_id,
          COALESCE(predecessor_end, CURRENT_TIMESTAMP),
          gap_candidate.scheduled_start_at,
          gap_candidate.duration_minutes
        )
        WHERE gap_minutes >= gap_candidate.duration_minutes
        ORDER BY gap_start ASC
        LIMIT 1
      LOOP
        move_minutes := EXTRACT(EPOCH FROM (gap_candidate.scheduled_start_at - available_gaps.gap_start))/60;
        
        -- Only minimum threshold check (0.25 days = 360 min)
        IF move_minutes < 360 THEN
          CONTINUE;
        END IF;
        
        new_start := available_gaps.gap_start;
        new_end := available_gaps.gap_start + (gap_candidate.scheduled_end_at - gap_candidate.scheduled_start_at);
        
        UPDATE stage_time_slots
        SET 
          slot_start_time = new_start,
          slot_end_time = new_end
        WHERE stage_instance_id = gap_candidate.stage_instance_id;
        
        UPDATE job_stage_instances
        SET 
          scheduled_start_at = new_start,
          scheduled_end_at = new_end,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = gap_candidate.stage_instance_id;
        
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ Reschedule complete: wrote_slots=%, updated_jsi=%', v_wrote_slots, v_updated_jsi;

  RETURN QUERY SELECT v_wrote_slots, v_updated_jsi, v_violations;
END;
$$;