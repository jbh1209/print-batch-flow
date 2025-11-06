-- Fix scheduler_append_jobs to enforce proper per-path barriers
-- Cover stages only wait for cover barrier, text only for text barrier, both for GREATEST(cover, text)

DROP FUNCTION IF EXISTS public.scheduler_append_jobs(uuid[], boolean);

CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[] DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_rec RECORD;
  v_stage_rec RECORD;
  v_cover_barrier timestamptz;
  v_text_barrier timestamptz;
  v_earliest_start timestamptz;
  v_resource_tail timestamptz;
  v_part_assignment text;
  v_wrote_slots int := 0;
  v_updated_jsi int := 0;
  v_base_start timestamptz := now();
  v_row_count int;
BEGIN
  RAISE NOTICE '=== SCHEDULER APPEND JOBS (FIFO per job, stage-by-stage) ===';
  RAISE NOTICE 'p_only_if_unset=%, p_job_ids=%', p_only_if_unset, COALESCE(array_length(p_job_ids, 1), 0);

  -- Job-first loop: FIFO by proof_approved_at
  FOR v_job_rec IN
    SELECT j.id as job_id, j.wo_no, j.proof_approved_at
    FROM production_jobs j
    WHERE (p_job_ids IS NULL OR j.id = ANY(p_job_ids))
      AND j.proof_approved_at IS NOT NULL
    ORDER BY j.proof_approved_at ASC
  LOOP
    RAISE NOTICE '--- Processing Job: % (WO: %) ---', v_job_rec.job_id, v_job_rec.wo_no;
    
    -- Reset barriers for this job
    v_cover_barrier := v_base_start;
    v_text_barrier := v_base_start;

    -- Stage-by-stage loop for this job
    FOR v_stage_rec IN
      SELECT 
        jsi.id as jsi_id,
        jsi.stage_name,
        jsi.stage_order,
        jsi.production_stage_id,
        jsi.scheduled_start_at,
        jsi.scheduled_end_at,
        COALESCE(
          (jsi.finishing_specifications->>'part_assignment')::text,
          'both'
        ) as part_assignment,
        COALESCE((jsi.finishing_specifications->>'duration_minutes')::int, 60) as duration_minutes
      FROM job_stage_instances jsi
      WHERE jsi.production_job_id = v_job_rec.job_id
        AND jsi.stage_name NOT ILIKE '%PROOF%'
        AND jsi.stage_name NOT ILIKE '%DTP%'
        AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
      ORDER BY jsi.stage_order ASC
    LOOP
      v_part_assignment := v_stage_rec.part_assignment;
      
      -- Get resource tail for this stage
      SELECT COALESCE(MAX(slot_end_time), v_base_start)
      INTO v_resource_tail
      FROM stage_time_slots
      WHERE production_stage_id = v_stage_rec.production_stage_id
        AND slot_end_time > now();

      -- Calculate earliest_start based on part assignment
      IF v_part_assignment = 'cover' THEN
        v_earliest_start := GREATEST(v_cover_barrier, v_resource_tail);
        RAISE NOTICE '  Stage % (cover): cover_barrier=%, resource_tail=%, earliest=%',
          v_stage_rec.stage_name, v_cover_barrier, v_resource_tail, v_earliest_start;
          
      ELSIF v_part_assignment = 'text' THEN
        v_earliest_start := GREATEST(v_text_barrier, v_resource_tail);
        RAISE NOTICE '  Stage % (text): text_barrier=%, resource_tail=%, earliest=%',
          v_stage_rec.stage_name, v_text_barrier, v_resource_tail, v_earliest_start;
          
      ELSE -- 'both'
        v_earliest_start := GREATEST(v_cover_barrier, v_text_barrier, v_resource_tail);
        RAISE NOTICE '  Stage % (both): cover_barrier=%, text_barrier=%, resource_tail=%, earliest=%',
          v_stage_rec.stage_name, v_cover_barrier, v_text_barrier, v_resource_tail, v_earliest_start;
      END IF;

      -- Place duration and write slots
      DECLARE
        v_intervals jsonb;
        v_final_start timestamptz;
        v_final_end timestamptz;
      BEGIN
        SELECT public.place_duration_sql(v_earliest_start, v_stage_rec.duration_minutes)
        INTO v_intervals;

        IF v_intervals IS NOT NULL AND jsonb_array_length(v_intervals) > 0 THEN
          v_final_start := (v_intervals->0->>'start')::timestamptz;
          v_final_end := (v_intervals->(jsonb_array_length(v_intervals)-1)->>'end')::timestamptz;

          -- Write slots
          INSERT INTO stage_time_slots (
            stage_instance_id,
            production_stage_id,
            production_job_id,
            slot_start_time,
            slot_end_time
          )
          SELECT
            v_stage_rec.jsi_id,
            v_stage_rec.production_stage_id,
            v_job_rec.job_id,
            (item->>'start')::timestamptz,
            (item->>'end')::timestamptz
          FROM jsonb_array_elements(v_intervals) item
          ON CONFLICT (stage_instance_id, slot_start_time) DO NOTHING;

          GET DIAGNOSTICS v_row_count = ROW_COUNT;
          v_wrote_slots := v_wrote_slots + v_row_count;

          -- Update JSI
          UPDATE job_stage_instances
          SET scheduled_start_at = v_final_start,
              scheduled_end_at = v_final_end
          WHERE id = v_stage_rec.jsi_id;

          GET DIAGNOSTICS v_row_count = ROW_COUNT;
          v_updated_jsi := v_updated_jsi + v_row_count;

          RAISE NOTICE '    → Scheduled: % to %', v_final_start, v_final_end;

          -- Update barriers for next stage
          IF v_part_assignment = 'cover' THEN
            v_cover_barrier := v_final_end;
          ELSIF v_part_assignment = 'text' THEN
            v_text_barrier := v_final_end;
          ELSE -- 'both'
            v_cover_barrier := v_final_end;
            v_text_barrier := v_final_end;
          END IF;
        END IF;
      END;
    END LOOP;
  END LOOP;

  -- Gap-filling phase
  DECLARE
    v_gap_filled int := 0;
    v_gap_stage_rec RECORD;
  BEGIN
    FOR v_gap_stage_rec IN
      SELECT 
        jsi.id as jsi_id,
        jsi.production_stage_id,
        jsi.production_job_id,
        jsi.stage_name,
        COALESCE((jsi.finishing_specifications->>'duration_minutes')::int, 60) as duration_minutes
      FROM job_stage_instances jsi
      INNER JOIN production_jobs j ON jsi.production_job_id = j.id
      WHERE (p_job_ids IS NULL OR jsi.production_job_id = ANY(p_job_ids))
        AND jsi.scheduled_start_at IS NULL
        AND jsi.stage_name NOT ILIKE '%PROOF%'
        AND jsi.stage_name NOT ILIKE '%DTP%'
        AND j.proof_approved_at IS NOT NULL
      ORDER BY j.proof_approved_at ASC, jsi.stage_order ASC
    LOOP
      DECLARE
        v_gap_tail timestamptz;
        v_gap_intervals jsonb;
        v_gap_start timestamptz;
        v_gap_end timestamptz;
      BEGIN
        SELECT COALESCE(MAX(slot_end_time), now())
        INTO v_gap_tail
        FROM stage_time_slots
        WHERE production_stage_id = v_gap_stage_rec.production_stage_id
          AND slot_end_time > now();

        SELECT public.place_duration_sql(v_gap_tail, v_gap_stage_rec.duration_minutes)
        INTO v_gap_intervals;

        IF v_gap_intervals IS NOT NULL AND jsonb_array_length(v_gap_intervals) > 0 THEN
          v_gap_start := (v_gap_intervals->0->>'start')::timestamptz;
          v_gap_end := (v_gap_intervals->(jsonb_array_length(v_gap_intervals)-1)->>'end')::timestamptz;

          INSERT INTO stage_time_slots (
            stage_instance_id,
            production_stage_id,
            production_job_id,
            slot_start_time,
            slot_end_time
          )
          SELECT
            v_gap_stage_rec.jsi_id,
            v_gap_stage_rec.production_stage_id,
            v_gap_stage_rec.production_job_id,
            (item->>'start')::timestamptz,
            (item->>'end')::timestamptz
          FROM jsonb_array_elements(v_gap_intervals) item
          ON CONFLICT (stage_instance_id, slot_start_time) DO NOTHING;

          UPDATE job_stage_instances
          SET scheduled_start_at = v_gap_start,
              scheduled_end_at = v_gap_end
          WHERE id = v_gap_stage_rec.jsi_id;

          v_gap_filled := v_gap_filled + 1;
          RAISE NOTICE 'Gap-filled: % → %', v_gap_stage_rec.stage_name, v_gap_start;
        END IF;
      END;
    END LOOP;
    
    v_wrote_slots := v_wrote_slots + v_gap_filled;
    v_updated_jsi := v_updated_jsi + v_gap_filled;
  END;

  RAISE NOTICE '=== COMPLETED: wrote_slots=%, updated_jsi=% ===', v_wrote_slots, v_updated_jsi;

  RETURN jsonb_build_object(
    'wrote_slots', v_wrote_slots,
    'updated_jsi', v_updated_jsi
  );
END;
$$;