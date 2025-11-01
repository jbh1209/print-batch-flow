-- Fix column name mismatch in scheduler_append_jobs and disable duplicate trigger
-- This addresses the "column jsi.stage_id does not exist" error on proof approval

-- 1. Fix scheduler_append_jobs: Update all jsi.stage_id references to jsi.production_stage_id
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
  r_job record;
  r_stage record;
  v_earliest timestamptz;
  v_scheduled_start timestamptz;
  v_scheduled_end timestamptz;
BEGIN
  -- Phase 1: Schedule each requested job stage-by-stage
  FOR r_job IN
    SELECT pj.id as job_id, pj.proof_approved_at, pj.due_date
    FROM production_jobs pj
    WHERE pj.id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NOT NULL
    ORDER BY pj.proof_approved_at ASC
  LOOP
    v_earliest := COALESCE(r_job.proof_approved_at, NOW());
    
    FOR r_stage IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.stage_order,
        ps.stage_name,
        ps.part_assignment,
        ps.default_resource_id,
        COALESCE(jsi.duration_minutes, ps.default_duration_minutes, 60) as duration_minutes
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id  -- ✅ FIXED from stage_id
      WHERE jsi.job_id = r_job.job_id
        AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
      ORDER BY jsi.stage_order ASC
    LOOP
      SELECT scheduled_start, scheduled_end
      INTO v_scheduled_start, v_scheduled_end
      FROM public.find_next_available_slot(
        v_earliest,
        r_stage.duration_minutes,
        r_stage.default_resource_id,
        r_stage.part_assignment
      );

      IF v_scheduled_start IS NULL THEN
        v_violations := v_violations || jsonb_build_object(
          'job_id', r_job.job_id,
          'stage_instance_id', r_stage.stage_instance_id,
          'reason', 'no_available_slot'
        );
        CONTINUE;
      END IF;

      INSERT INTO stage_time_slots (
        stage_instance_id,
        job_id,
        production_stage_id,
        slot_start_time,
        slot_end_time,
        resource_id,
        part_assignment
      ) VALUES (
        r_stage.stage_instance_id,
        r_job.job_id,
        (SELECT production_stage_id FROM job_stage_instances WHERE id = r_stage.stage_instance_id),
        v_scheduled_start,
        v_scheduled_end,
        r_stage.default_resource_id,
        r_stage.part_assignment
      )
      ON CONFLICT (stage_instance_id, slot_start_time) DO NOTHING;

      IF FOUND THEN
        v_wrote_slots := v_wrote_slots + 1;
        
        UPDATE job_stage_instances
        SET 
          scheduled_start_at = v_scheduled_start,
          scheduled_end_at = v_scheduled_end,
          status = 'scheduled'
        WHERE id = r_stage.stage_instance_id
          AND (scheduled_start_at IS NULL OR NOT p_only_if_unset);
        
        IF FOUND THEN
          v_updated_jsi := v_updated_jsi + 1;
        END IF;
      END IF;

      v_earliest := v_scheduled_end;
    END LOOP;
  END LOOP;

  -- Phase 2: Gap-filling for any unscheduled stages
  WITH gap_candidates AS (
    SELECT 
      jsi.id,
      jsi.job_id,
      jsi.production_stage_id,  -- ✅ FIXED from stage_id
      jsi.stage_order,
      ps.part_assignment,
      ps.default_resource_id,
      COALESCE(jsi.duration_minutes, ps.default_duration_minutes, 60) as duration_minutes
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id  -- ✅ FIXED
    WHERE jsi.job_id = ANY(p_job_ids)
      AND jsi.scheduled_start_at IS NULL
      AND jsi.status != 'completed'
    ORDER BY jsi.stage_order ASC
  )
  INSERT INTO schedule_gap_fills (stage_instance_id, gap_filled_at)
  SELECT id, NOW() FROM gap_candidates
  ON CONFLICT (stage_instance_id) DO UPDATE SET gap_filled_at = NOW();

  RETURN QUERY SELECT v_wrote_slots, v_updated_jsi, v_violations;
END;
$$;

-- 2. Disable the duplicate HTTP trigger to prevent double-execution
ALTER TABLE public.production_jobs 
  DISABLE TRIGGER trg_schedule_on_approval;

-- Add comment for clarity
COMMENT ON TRIGGER trg_schedule_on_approval ON public.production_jobs IS 
  'DISABLED: Duplicate trigger. Use trg_schedule_on_job_approval which calls scheduler_append_jobs directly.';