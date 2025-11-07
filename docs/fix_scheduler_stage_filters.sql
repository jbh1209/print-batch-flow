-- ============================================================
-- FIX: Exclude DTP/PROOF/BATCH stages from scheduler functions
-- ============================================================
-- Problem: Oct 25th scheduler is creating time slots for DTP and PROOF stages
--          These pre-production stages should NEVER be scheduled
--          Their scheduled_end_at values cause artificial delays in downstream stages
-- Solution: Add stage name exclusion filters in 3 critical locations
-- ============================================================

-- First, read the current functions to modify
-- We need to add filters to:
-- 1. scheduler_append_jobs (line 213)
-- 2. scheduler_reschedule_all_parallel_aware Phase 1 (line 749)
-- 3. scheduler_reschedule_all_parallel_aware Phase 2 gap-filling (line 907-908)

-- ============================================================
-- PART 1: Fix scheduler_append_jobs
-- ============================================================

DROP FUNCTION IF EXISTS public.scheduler_append_jobs(p_job_ids uuid[], p_base_start timestamptz, p_commit boolean) CASCADE;

CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[],
  p_base_start timestamptz DEFAULT NULL,
  p_commit boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  base_time timestamptz;
  r_job RECORD;
  r_stage_group RECORD;
  r_stage RECORD;
  stage_earliest_start timestamptz;
  cover_barrier_time timestamptz;
  text_barrier_time timestamptz;
  main_barrier_time timestamptz;
  barrier_key text;
  job_stage_barriers jsonb;
  stage_result jsonb;
  stage_tail timestamptz;
  wrote_slots integer := 0;
  updated_jsi integer := 0;
  job_failed boolean;
BEGIN
  base_time := COALESCE(p_base_start, public.next_working_start(NOW(), NULL));
  
  PERFORM public.create_stage_availability_tracker();
  
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    COALESCE(MAX(slot_end_time), base_time)
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id;

  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.job_table_name,
      COALESCE(pj.approved_at, pj.created_at) as approved_at
    FROM production_jobs pj
    WHERE pj.id = ANY(p_job_ids)
    ORDER BY COALESCE(pj.approved_at, pj.created_at) ASC
  LOOP
    job_failed := false;
    job_stage_barriers := '{}'::jsonb;
    
    FOR r_stage_group IN
      SELECT
        sg.id,
        ARRAY_AGG(jsi.id ORDER BY jsi.stage_order) as stage_instance_ids
      FROM stage_groups sg
      JOIN job_stage_instances jsi ON jsi.stage_group_id = sg.id
      WHERE jsi.job_id = r_job.job_id
        AND jsi.schedule_status IN ('pending', 'scheduled')
      GROUP BY sg.id
      ORDER BY MIN(jsi.stage_order) ASC
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
          -- ✅ CRITICAL: Exclude DTP/PROOF/BATCH stages from scheduling
          AND ps.name NOT ILIKE '%dtp%' 
          AND ps.name NOT ILIKE '%proof%'
          AND ps.name NOT ILIKE '%batch%allocation%'
        ORDER BY jsi.id
      LOOP
        IF r_stage.duration_minutes IS NULL OR r_stage.duration_minutes <= 0 THEN
          RAISE WARNING '⚠️ INVALID DURATION for job % (WO: %), stage %: duration=% mins. ROLLING BACK JOB.',
            r_job.job_id, r_job.wo_no, r_stage.stage_name, r_stage.duration_minutes;
          job_failed := true;
          EXIT;
        END IF;
        
        IF r_stage.part_assignment = 'both' THEN
          cover_barrier_time := COALESCE((job_stage_barriers->>'cover')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          text_barrier_time := COALESCE((job_stage_barriers->>'text')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          main_barrier_time := COALESCE((job_stage_barriers->>'main')::timestamptz, GREATEST(base_time, r_job.proof_approved_at));
          
          stage_earliest_start := GREATEST(cover_barrier_time, text_barrier_time, main_barrier_time);
          barrier_key := 'both';
        ELSE
          stage_earliest_start := COALESCE(
            (job_stage_barriers->>COALESCE(r_stage.part_assignment, 'main'))::timestamptz,
            GREATEST(base_time, r_job.proof_approved_at)
          );
          barrier_key := COALESCE(r_stage.part_assignment, 'main');
        END IF;

        SELECT COALESCE(next_available_time, stage_earliest_start)
        INTO stage_tail
        FROM _stage_tails
        WHERE stage_id = r_stage.production_stage_id;
        
        stage_earliest_start := GREATEST(stage_earliest_start, COALESCE(stage_tail, stage_earliest_start));

        stage_result := public.schedule_stage_instance(
          r_stage.stage_instance_id,
          stage_earliest_start,
          r_stage.duration_minutes,
          r_stage.production_stage_id,
          p_commit
        );

        IF (stage_result->>'ok')::boolean THEN
          wrote_slots := wrote_slots + (stage_result->>'slots_written')::integer;
          updated_jsi := updated_jsi + 1;
          
          job_stage_barriers := jsonb_set(
            job_stage_barriers,
            ARRAY[barrier_key],
            to_jsonb((stage_result->>'scheduled_end_at')::timestamptz)
          );
          
          INSERT INTO _stage_tails(stage_id, next_available_time)
          VALUES (r_stage.production_stage_id, (stage_result->>'tail_time')::timestamptz)
          ON CONFLICT (stage_id)
          DO UPDATE SET next_available_time = EXCLUDED.next_available_time;
        ELSE
          RAISE WARNING '⚠️ Failed to schedule stage % for job %: %',
            r_stage.stage_name, r_job.wo_no, stage_result->>'error';
          job_failed := true;
          EXIT;
        END IF;
      END LOOP;
      
      IF job_failed THEN
        EXIT;
      END IF;
    END LOOP;
    
    IF job_failed THEN
      RAISE WARNING '⚠️ Job % (WO: %) failed scheduling. Skipping.', r_job.job_id, r_job.wo_no;
      CONTINUE;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'wrote_slots', wrote_slots,
    'updated_jsi', updated_jsi
  );
END;
$$;

ALTER FUNCTION public.scheduler_append_jobs(p_job_ids uuid[], p_base_start timestamptz, p_commit boolean) OWNER TO postgres;

-- ============================================================
-- PART 2: Fix scheduler_reschedule_all_parallel_aware
-- ============================================================

DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(p_base_start timestamptz, p_commit boolean) CASCADE;

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_base_start timestamptz DEFAULT NULL,
  p_commit boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  base_time timestamptz;
  r_job RECORD;
  r_stage_group RECORD;
  r_stage RECORD;
  stage_earliest_start timestamptz;
  cover_barrier_time timestamptz;
  text_barrier_time timestamptz;
  main_barrier_time timestamptz;
  barrier_key text;
  job_stage_barriers jsonb;
  stage_result jsonb;
  stage_tail timestamptz;
  wrote_slots integer := 0;
  updated_jsi integer := 0;
  gap_candidate RECORD;
  original_start timestamptz;
  earliest_possible_start timestamptz;
  gap_fill_result jsonb;
  gap_filled_count integer := 0;
BEGIN
  base_time := COALESCE(p_base_start, public.next_working_start(NOW(), NULL));
  
  IF p_commit THEN
    DELETE FROM stage_time_slots
    WHERE slot_start_time >= base_time;
  END IF;

  PERFORM public.create_stage_availability_tracker();
  
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    COALESCE(MAX(slot_end_time), base_time)
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id;

  -- ============================================================
  -- PHASE 1: Schedule all pending jobs in precedence order
  -- ============================================================
  
  FOR r_job IN
    SELECT 
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at,
      pj.job_table_name,
      COALESCE(pj.approved_at, pj.created_at) as approved_at
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
    ORDER BY COALESCE(pj.approved_at, pj.created_at) ASC
  LOOP
    job_stage_barriers := '{}'::jsonb;
    
    FOR r_stage_group IN
      SELECT
        sg.id,
        ARRAY_AGG(jsi.id ORDER BY jsi.stage_order) as stage_instance_ids
      FROM stage_groups sg
      JOIN job_stage_instances jsi ON jsi.stage_group_id = sg.id
      WHERE jsi.job_id = r_job.job_id
        AND jsi.schedule_status IN ('pending', 'scheduled')
      GROUP BY sg.id
      ORDER BY MIN(jsi.stage_order) ASC
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
          -- ✅ CRITICAL: Exclude DTP/PROOF/BATCH stages from scheduling
          AND ps.name NOT ILIKE '%dtp%' 
          AND ps.name NOT ILIKE '%proof%'
          AND ps.name NOT ILIKE '%batch%allocation%'
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
          stage_earliest_start := COALESCE(
            (job_stage_barriers->>COALESCE(r_stage.part_assignment, 'main'))::timestamptz,
            GREATEST(base_time, r_job.proof_approved_at)
          );
          barrier_key := COALESCE(r_stage.part_assignment, 'main');
        END IF;

        SELECT COALESCE(next_available_time, stage_earliest_start)
        INTO stage_tail
        FROM _stage_tails
        WHERE stage_id = r_stage.production_stage_id;
        
        stage_earliest_start := GREATEST(stage_earliest_start, COALESCE(stage_tail, stage_earliest_start));

        stage_result := public.schedule_stage_instance(
          r_stage.stage_instance_id,
          stage_earliest_start,
          r_stage.duration_minutes,
          r_stage.production_stage_id,
          p_commit
        );

        IF (stage_result->>'ok')::boolean THEN
          wrote_slots := wrote_slots + (stage_result->>'slots_written')::integer;
          updated_jsi := updated_jsi + 1;
          
          job_stage_barriers := jsonb_set(
            job_stage_barriers,
            ARRAY[barrier_key],
            to_jsonb((stage_result->>'scheduled_end_at')::timestamptz)
          );
          
          INSERT INTO _stage_tails(stage_id, next_available_time)
          VALUES (r_stage.production_stage_id, (stage_result->>'tail_time')::timestamptz)
          ON CONFLICT (stage_id)
          DO UPDATE SET next_available_time = EXCLUDED.next_available_time;
        ELSE
          RAISE WARNING '⚠️ Failed to schedule stage % for job %: %',
            r_stage.stage_name, r_job.wo_no, stage_result->>'error';
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ============================================================
  -- PHASE 2: Gap-filling for short stages (<= 2 hours)
  -- ============================================================
  
  IF p_commit THEN
    FOR gap_candidate IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.production_stage_id,
        jsi.job_id,
        jsi.scheduled_start_at,
        jsi.scheduled_minutes,
        jsi.stage_order,
        jsi.part_assignment,
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
        -- ✅ CRITICAL: Exclude DTP/PROOF/BATCH stages from gap-filling
        AND ps.name NOT ILIKE '%dtp%' 
        AND ps.name NOT ILIKE '%proof%'
        AND ps.name NOT ILIKE '%batch%allocation%'
      ORDER BY 
        jsi.job_id,
        jsi.stage_order ASC,
        jsi.scheduled_start_at ASC
    LOOP
      original_start := gap_candidate.scheduled_start_at;
      
      SELECT COALESCE(MAX(jsi2.scheduled_end_at), base_time)
      INTO earliest_possible_start
      FROM job_stage_instances jsi2
      WHERE jsi2.job_id = gap_candidate.job_id
        AND jsi2.stage_order < gap_candidate.stage_order
        AND (
          gap_candidate.part_assignment IS NULL 
          OR jsi2.part_assignment IS NULL 
          OR jsi2.part_assignment = gap_candidate.part_assignment 
          OR jsi2.part_assignment = 'both' 
          OR gap_candidate.part_assignment = 'both'
        );

      IF earliest_possible_start < original_start THEN
        gap_fill_result := public.schedule_stage_instance(
          gap_candidate.stage_instance_id,
          earliest_possible_start,
          gap_candidate.scheduled_minutes,
          gap_candidate.production_stage_id,
          true
        );

        IF (gap_fill_result->>'ok')::boolean THEN
          IF (gap_fill_result->>'scheduled_start_at')::timestamptz < original_start THEN
            gap_filled_count := gap_filled_count + 1;
            RAISE NOTICE '✨ Gap-filled % (WO: %) stage %: moved from % to %',
              gap_candidate.stage_instance_id, gap_candidate.wo_no, gap_candidate.stage_name,
              original_start, (gap_fill_result->>'scheduled_start_at')::timestamptz;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'wrote_slots', wrote_slots,
    'updated_jsi', updated_jsi,
    'gap_filled_count', gap_filled_count
  );
END;
$$;

ALTER FUNCTION public.scheduler_reschedule_all_parallel_aware(p_base_start timestamptz, p_commit boolean) OWNER TO postgres;

-- ============================================================
-- VERIFICATION STEPS
-- ============================================================
-- After executing this file:
-- 
-- 1. Run reschedule-all from the UI
-- 
-- 2. Verify NO DTP/PROOF/BATCH stages in stage_time_slots:
--    SELECT COUNT(*) FROM stage_time_slots sts 
--    JOIN production_stages ps ON ps.id = sts.production_stage_id 
--    WHERE ps.name ILIKE '%proof%' OR ps.name ILIKE '%dtp%' OR ps.name ILIKE '%batch%allocation%';
--    -- Expected: 0 rows
-- 
-- 3. Verify tight packing - check D427290 on HP 12000:
--    SELECT jsi.id, pj.wo_no, ps.name, jsi.scheduled_start_at, jsi.scheduled_end_at
--    FROM job_stage_instances jsi
--    JOIN production_jobs pj ON pj.id = jsi.job_id
--    JOIN production_stages ps ON ps.id = jsi.production_stage_id
--    WHERE pj.wo_no IN ('D427290', 'D427291')
--      AND ps.name ILIKE '%hp%12000%'
--    ORDER BY jsi.scheduled_start_at;
--    -- D427290 should start immediately after D427291 ends (Friday Nov 7)
-- 
-- 4. Verify NO scheduled_* timestamps for DTP/PROOF stages:
--    SELECT jsi.id, pj.wo_no, ps.name, jsi.scheduled_start_at, jsi.scheduled_end_at
--    FROM job_stage_instances jsi
--    JOIN production_jobs pj ON pj.id = jsi.job_id
--    JOIN production_stages ps ON ps.id = jsi.production_stage_id
--    WHERE ps.name ILIKE '%proof%' OR ps.name ILIKE '%dtp%'
--    ORDER BY pj.wo_no;
--    -- scheduled_start_at and scheduled_end_at should be NULL
-- 
-- ============================================================
