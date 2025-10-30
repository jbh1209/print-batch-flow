-- Fix overlap check in scheduler_append_jobs to prevent unique constraint violations
-- Drop and recreate the function with the fixed overlap check

DROP FUNCTION IF EXISTS scheduler_append_jobs(UUID[], BOOLEAN);

CREATE OR REPLACE FUNCTION scheduler_append_jobs(
  p_job_ids UUID[],
  p_only_if_unset BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(wrote_slots INT, updated_jsi INT) AS $$
DECLARE
  job_rec RECORD;
  r_stage RECORD;
  slot_record JSONB;
  slots_written INT := 0;
  stages_updated INT := 0;
  overlap_count INT;
  inserted_count INT;
  new_slot_id UUID;
BEGIN
  RAISE NOTICE '[scheduler_append_jobs] Starting append for % jobs (only_if_unset=%)', array_length(p_job_ids, 1), p_only_if_unset;

  -- Loop through each job individually
  FOR job_rec IN
    SELECT j.id, j.wo_number, j.proof_approved_at
    FROM jobs j
    WHERE j.id = ANY(p_job_ids)
      AND j.proof_approved_at IS NOT NULL
    ORDER BY j.proof_approved_at ASC
  LOOP
    BEGIN
      RAISE NOTICE '[scheduler_append_jobs] Processing job % (WO: %)', job_rec.id, job_rec.wo_number;

      -- Phase 1: Insert slots for this job
      FOR r_stage IN
        SELECT 
          jsi.id,
          jsi.job_id,
          jsi.production_stage_id,
          jsi.status,
          jsi.scheduled_start_at,
          jsi.scheduled_end_at,
          jsi.scheduled_minutes,
          jsi.schedule_status,
          jsi.schedule_slots
        FROM job_stage_instances jsi
        WHERE jsi.job_id = job_rec.id
          AND jsi.production_stage_id IS NOT NULL
          AND (
            (p_only_if_unset = FALSE)
            OR 
            (p_only_if_unset = TRUE AND jsi.scheduled_start_at IS NULL)
          )
        ORDER BY jsi.id
      LOOP
        IF r_stage.schedule_slots IS NULL OR jsonb_array_length(r_stage.schedule_slots) = 0 THEN
          RAISE NOTICE '[scheduler_append_jobs] Stage % has no schedule_slots, skipping', r_stage.id;
          CONTINUE;
        END IF;

        -- Insert each slot, checking for overlaps BEFORE insert
        FOR slot_record IN SELECT * FROM jsonb_array_elements(r_stage.schedule_slots)
        LOOP
          -- FIXED: Check for BOTH range overlap AND exact start time match
          SELECT COUNT(*) INTO overlap_count
          FROM stage_time_slots existing
          WHERE existing.production_stage_id = r_stage.production_stage_id
            AND existing.is_completed = false
            AND (
              -- Check for range overlap
              tstzrange(existing.slot_start_time, existing.slot_end_time, '[)') &&
              tstzrange((slot_record->>'start_time')::timestamptz, (slot_record->>'end_time')::timestamptz, '[)')
              OR
              -- NEW: Check for exact start time match (the unique constraint)
              existing.slot_start_time = (slot_record->>'start_time')::timestamptz
            );

          IF overlap_count > 0 THEN
            RAISE NOTICE '[scheduler_append_jobs] Overlap detected for stage % at %, rolling back job %', 
              r_stage.id, slot_record->>'start_time', job_rec.wo_number;
            RAISE EXCEPTION 'Overlap detected - rolling back job %', job_rec.wo_number;
          END IF;

          -- Safe to insert
          INSERT INTO stage_time_slots (
            id, job_stage_instance_id, production_stage_id,
            slot_start_time, slot_end_time, slot_duration_minutes, is_completed
          )
          VALUES (
            gen_random_uuid(),
            r_stage.id,
            r_stage.production_stage_id,
            (slot_record->>'start_time')::timestamptz,
            (slot_record->>'end_time')::timestamptz,
            (slot_record->>'minutes')::integer,
            false
          )
          ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING;

          GET DIAGNOSTICS inserted_count = ROW_COUNT;
          
          IF inserted_count = 0 THEN
            RAISE NOTICE '[scheduler_append_jobs] Conflict on insert for stage % at %, rolling back job %',
              r_stage.id, slot_record->>'start_time', job_rec.wo_number;
            RAISE EXCEPTION 'Insert conflict - rolling back job %', job_rec.wo_number;
          END IF;

          slots_written := slots_written + 1;
        END LOOP;

        stages_updated := stages_updated + 1;
      END LOOP;

      RAISE NOTICE '[scheduler_append_jobs] ✅ Job % completed: % slots written', job_rec.wo_number, slots_written;

    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '[scheduler_append_jobs] ❌ Job % failed: %, rolling back', job_rec.wo_number, SQLERRM;
        RAISE;
    END;
  END LOOP;

  RAISE NOTICE '[scheduler_append_jobs] Total: % stages updated, % slots written', stages_updated, slots_written;
  
  RETURN QUERY SELECT slots_written, stages_updated;
END;
$$ LANGUAGE plpgsql;