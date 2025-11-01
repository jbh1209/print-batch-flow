-- Fix scheduler_reschedule_all_parallel_aware with proper variable declarations
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_commit BOOLEAN DEFAULT FALSE,
  p_only_job_ids UUID[] DEFAULT NULL,
  p_base_start TIMESTAMPTZ DEFAULT NOW(),
  p_lookback_days INTEGER DEFAULT 14
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wrote_slots INTEGER := 0;
  v_updated_jsi INTEGER := 0;
  v_violations JSONB := '[]'::JSONB;
  
  r_job RECORD;
  r_stage RECORD;
  r_interval RECORD;
  
  stage_earliest_start TIMESTAMPTZ;
  predecessor_end TIMESTAMPTZ;
  slot_start TIMESTAMPTZ;
  slot_end TIMESTAMPTZ;
  remaining_minutes NUMERIC;
  
  gap_candidate RECORD;
  best_gap RECORD;
  gain_minutes NUMERIC;
BEGIN
  RAISE NOTICE 'scheduler_reschedule_all_parallel_aware: commit=%, base_start=%, lookback_days=%', 
    p_commit, p_base_start, p_lookback_days;

  FOR r_job IN
    SELECT 
      pj.id AS job_id,
      pj.wo_number,
      pj.proof_approved_at
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
      AND (p_only_job_ids IS NULL OR pj.id = ANY(p_only_job_ids))
    ORDER BY pj.proof_approved_at ASC
  LOOP
    RAISE NOTICE 'Scheduling job: % (WO: %)', r_job.job_id, r_job.wo_number;

    FOR r_stage IN
      SELECT
        jsi.id AS stage_instance_id,
        jsi.stage_order,
        ps.name AS stage_name,
        jsi.part_assignment,
        jsi.production_stage_id,
        COALESCE(jsi.estimated_duration_minutes + COALESCE(jsi.setup_time_minutes, 0), 60) AS duration_minutes
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND jsi.job_table_name = 'production_jobs'
        AND jsi.status IN ('pending', 'scheduled', 'active')
      ORDER BY jsi.stage_order ASC NULLS LAST, jsi.created_at ASC
    LOOP
      stage_earliest_start := GREATEST(r_job.proof_approved_at, p_base_start);
      
      SELECT MAX(jsi2.scheduled_end_at)
      INTO predecessor_end
      FROM job_stage_instances jsi2
      WHERE jsi2.job_id = r_job.job_id
        AND jsi2.job_table_name = 'production_jobs'
        AND jsi2.stage_order < r_stage.stage_order
        AND (r_stage.part_assignment IS NULL OR jsi2.part_assignment = r_stage.part_assignment)
        AND jsi2.scheduled_end_at IS NOT NULL;
      
      IF predecessor_end IS NOT NULL AND predecessor_end > stage_earliest_start THEN
        stage_earliest_start := predecessor_end;
      END IF;

      SELECT COALESCE(MAX(sts.slot_end_time), stage_earliest_start)
      INTO stage_earliest_start
      FROM stage_time_slots sts
      WHERE sts.production_stage_id = r_stage.production_stage_id
        AND sts.slot_end_time > stage_earliest_start - INTERVAL '1 day';

      remaining_minutes := r_stage.duration_minutes;
      slot_start := NULL;
      slot_end := NULL;

      FOR r_interval IN
        SELECT interval_start, interval_end
        FROM find_next_working_intervals(stage_earliest_start, 60)
        ORDER BY interval_start
      LOOP
        IF slot_start IS NULL THEN
          slot_start := r_interval.interval_start;
        END IF;
        
        slot_end := r_interval.interval_end;
        remaining_minutes := remaining_minutes - EXTRACT(EPOCH FROM (r_interval.interval_end - r_interval.interval_start)) / 60;
        
        IF remaining_minutes <= 0 THEN
          EXIT;
        END IF;
      END LOOP;

      IF p_commit AND slot_start IS NOT NULL AND slot_end IS NOT NULL THEN
        INSERT INTO stage_time_slots (
          production_stage_id,
          date,
          slot_start_time,
          slot_end_time,
          duration_minutes,
          job_id,
          job_table_name,
          stage_instance_id
        ) VALUES (
          r_stage.production_stage_id,
          slot_start::date,
          slot_start,
          slot_end,
          EXTRACT(EPOCH FROM (slot_end - slot_start)) / 60,
          r_job.job_id,
          'production_jobs',
          r_stage.stage_instance_id
        )
        ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING;
        
        v_wrote_slots := v_wrote_slots + 1;

        UPDATE job_stage_instances
        SET 
          scheduled_start_at = slot_start,
          scheduled_end_at = slot_end,
          scheduled_minutes = EXTRACT(EPOCH FROM (slot_end - slot_start)) / 60,
          schedule_status = 'scheduled',
          updated_at = NOW()
        WHERE id = r_stage.stage_instance_id;
        
        v_updated_jsi := v_updated_jsi + 1;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Phase 2: Gap-filling for future stages';
  
  FOR gap_candidate IN
    SELECT
      jsi.id AS stage_instance_id,
      jsi.production_stage_id,
      jsi.scheduled_start_at,
      jsi.scheduled_end_at,
      jsi.part_assignment,
      jsi.job_id,
      jsi.stage_order,
      COALESCE(jsi.estimated_duration_minutes + COALESCE(jsi.setup_time_minutes, 0), 60) AS duration_minutes
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.scheduled_start_at IS NOT NULL
      AND jsi.scheduled_end_at IS NOT NULL
      AND jsi.scheduled_start_at > NOW() + INTERVAL '1 day'
      AND ps.allow_gap_filling = TRUE
      AND (p_only_job_ids IS NULL OR jsi.job_id = ANY(p_only_job_ids))
    ORDER BY jsi.scheduled_start_at DESC
  LOOP
    SELECT MAX(jsi2.scheduled_end_at)
    INTO predecessor_end
    FROM job_stage_instances jsi2
    WHERE jsi2.job_id = gap_candidate.job_id
      AND jsi2.job_table_name = 'production_jobs'
      AND jsi2.stage_order < gap_candidate.stage_order
      AND (gap_candidate.part_assignment IS NULL OR jsi2.part_assignment = gap_candidate.part_assignment)
      AND jsi2.scheduled_end_at IS NOT NULL;

    SELECT *
    INTO best_gap
    FROM find_available_gaps(
      gap_candidate.production_stage_id,
      gap_candidate.duration_minutes,
      COALESCE(predecessor_end, NOW()),
      p_lookback_days,
      gap_candidate.scheduled_start_at
    )
    ORDER BY gap_start ASC
    LIMIT 1;

    IF best_gap IS NOT NULL THEN
      gain_minutes := EXTRACT(EPOCH FROM (gap_candidate.scheduled_start_at - best_gap.gap_start)) / 60;
      
      IF gain_minutes >= 360 AND p_commit THEN
        UPDATE stage_time_slots
        SET
          slot_start_time = best_gap.gap_start,
          slot_end_time = best_gap.gap_start + (gap_candidate.duration_minutes || ' minutes')::INTERVAL,
          date = best_gap.gap_start::date,
          duration_minutes = gap_candidate.duration_minutes,
          updated_at = NOW()
        WHERE stage_instance_id = gap_candidate.stage_instance_id;

        UPDATE job_stage_instances
        SET
          scheduled_start_at = best_gap.gap_start,
          scheduled_end_at = best_gap.gap_start + (gap_candidate.duration_minutes || ' minutes')::INTERVAL,
          scheduled_minutes = gap_candidate.duration_minutes,
          updated_at = NOW()
        WHERE id = gap_candidate.stage_instance_id;
        
        RAISE NOTICE 'Gap-filled stage % forward by % minutes', gap_candidate.stage_instance_id, gain_minutes;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Completed: wrote_slots=%, updated_jsi=%', v_wrote_slots, v_updated_jsi;

  RETURN jsonb_build_object(
    'wrote_slots', v_wrote_slots,
    'updated_jsi', v_updated_jsi,
    'violations', v_violations
  );
END;
$$;

-- Fix scheduler_append_jobs with proper variable declarations
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids UUID[],
  p_commit BOOLEAN DEFAULT FALSE,
  p_base_start TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wrote_slots INTEGER := 0;
  v_updated_jsi INTEGER := 0;
  
  r_job RECORD;
  r_stage RECORD;
  r_interval RECORD;
  
  stage_earliest_start TIMESTAMPTZ;
  predecessor_end TIMESTAMPTZ;
  slot_start TIMESTAMPTZ;
  slot_end TIMESTAMPTZ;
  remaining_minutes NUMERIC;
BEGIN
  RAISE NOTICE 'scheduler_append_jobs: commit=%, base_start=%, job_ids=%', 
    p_commit, p_base_start, p_job_ids;

  FOR r_job IN
    SELECT 
      pj.id AS job_id,
      pj.wo_number,
      pj.proof_approved_at
    FROM production_jobs pj
    WHERE pj.id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NOT NULL
    ORDER BY pj.proof_approved_at ASC
  LOOP
    RAISE NOTICE 'Appending job: % (WO: %)', r_job.job_id, r_job.wo_number;

    FOR r_stage IN
      SELECT
        jsi.id AS stage_instance_id,
        jsi.stage_order,
        ps.name AS stage_name,
        jsi.part_assignment,
        jsi.production_stage_id,
        COALESCE(jsi.estimated_duration_minutes + COALESCE(jsi.setup_time_minutes, 0), 60) AS duration_minutes
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND jsi.job_table_name = 'production_jobs'
        AND jsi.status IN ('pending', 'scheduled', 'active')
        AND jsi.scheduled_start_at IS NULL
      ORDER BY jsi.stage_order ASC NULLS LAST, jsi.created_at ASC
    LOOP
      stage_earliest_start := GREATEST(r_job.proof_approved_at, p_base_start);
      
      SELECT MAX(jsi2.scheduled_end_at)
      INTO predecessor_end
      FROM job_stage_instances jsi2
      WHERE jsi2.job_id = r_job.job_id
        AND jsi2.job_table_name = 'production_jobs'
        AND jsi2.stage_order < r_stage.stage_order
        AND (r_stage.part_assignment IS NULL OR jsi2.part_assignment = r_stage.part_assignment)
        AND jsi2.scheduled_end_at IS NOT NULL;
      
      IF predecessor_end IS NOT NULL AND predecessor_end > stage_earliest_start THEN
        stage_earliest_start := predecessor_end;
      END IF;

      SELECT COALESCE(MAX(sts.slot_end_time), stage_earliest_start)
      INTO stage_earliest_start
      FROM stage_time_slots sts
      WHERE sts.production_stage_id = r_stage.production_stage_id
        AND sts.slot_end_time > stage_earliest_start - INTERVAL '1 day';

      remaining_minutes := r_stage.duration_minutes;
      slot_start := NULL;
      slot_end := NULL;

      FOR r_interval IN
        SELECT interval_start, interval_end
        FROM find_next_working_intervals(stage_earliest_start, 60)
        ORDER BY interval_start
      LOOP
        IF slot_start IS NULL THEN
          slot_start := r_interval.interval_start;
        END IF;
        
        slot_end := r_interval.interval_end;
        remaining_minutes := remaining_minutes - EXTRACT(EPOCH FROM (r_interval.interval_end - r_interval.interval_start)) / 60;
        
        IF remaining_minutes <= 0 THEN
          EXIT;
        END IF;
      END LOOP;

      IF p_commit AND slot_start IS NOT NULL AND slot_end IS NOT NULL THEN
        INSERT INTO stage_time_slots (
          production_stage_id,
          date,
          slot_start_time,
          slot_end_time,
          duration_minutes,
          job_id,
          job_table_name,
          stage_instance_id
        ) VALUES (
          r_stage.production_stage_id,
          slot_start::date,
          slot_start,
          slot_end,
          EXTRACT(EPOCH FROM (slot_end - slot_start)) / 60,
          r_job.job_id,
          'production_jobs',
          r_stage.stage_instance_id
        )
        ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING;
        
        v_wrote_slots := v_wrote_slots + 1;

        UPDATE job_stage_instances
        SET 
          scheduled_start_at = slot_start,
          scheduled_end_at = slot_end,
          scheduled_minutes = EXTRACT(EPOCH FROM (slot_end - slot_start)) / 60,
          schedule_status = 'scheduled',
          updated_at = NOW()
        WHERE id = r_stage.stage_instance_id;
        
        v_updated_jsi := v_updated_jsi + 1;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Completed: wrote_slots=%, updated_jsi=%', v_wrote_slots, v_updated_jsi;

  RETURN jsonb_build_object(
    'wrote_slots', v_wrote_slots,
    'updated_jsi', v_updated_jsi
  );
END;
$$;