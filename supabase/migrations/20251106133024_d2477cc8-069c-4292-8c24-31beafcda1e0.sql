-- Fix scheduler to use job-level proof approval instead of stage-level
-- The scheduler must check production_jobs.proof_approved_at, not stage fields

DROP FUNCTION IF EXISTS public.scheduler_append_jobs(uuid[], boolean);

CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[] DEFAULT NULL,
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE (
  wrote_slots integer,
  updated_jsi integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
  v_wrote_slots integer := 0;
  job_rec record;
  stage_rec record;
  v_last_end timestamptz;
  v_base timestamptz;
  v_duration integer;
BEGIN
  -- Iterate jobs in FIFO by proof_approved_at from production_jobs table
  -- ONLY schedule jobs with proof_approved_at set
  FOR job_rec IN
    SELECT pj.id AS job_id,
           pj.proof_approved_at AS job_anchor
    FROM public.production_jobs pj
    WHERE (p_job_ids IS NULL OR pj.id = ANY(p_job_ids))
      AND pj.proof_approved_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.job_stage_instances jsi
        WHERE jsi.job_id = pj.id
          AND jsi.completed_at IS NULL
      )
    ORDER BY pj.proof_approved_at NULLS LAST
  LOOP
    v_last_end := NULL;

    -- Stages within job, ordered sequentially
    FOR stage_rec IN
      SELECT jsi.id,
             jsi.stage_order,
             jsi.estimated_duration_minutes,
             jsi.scheduled_start_at,
             jsi.scheduled_end_at
      FROM public.job_stage_instances jsi
      JOIN public.production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = job_rec.job_id
        AND NOT (ps.name ILIKE '%PROOF%' OR ps.name ILIKE '%DTP%')
        AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
        AND jsi.completed_at IS NULL
      ORDER BY jsi.stage_order NULLS LAST, jsi.created_at
    LOOP
      -- Use job's proof_approved_at as base anchor
      v_base := job_rec.job_anchor;
      IF v_last_end IS NULL OR v_last_end < v_base THEN
        v_last_end := v_base;
      END IF;

      v_duration := COALESCE(NULLIF(stage_rec.estimated_duration_minutes, 0), 60);

      UPDATE public.job_stage_instances
      SET scheduled_start_at = v_last_end,
          scheduled_end_at   = v_last_end + make_interval(mins => v_duration),
          scheduled_minutes  = v_duration,
          schedule_status    = 'scheduled',
          updated_at         = now()
      WHERE id = stage_rec.id;

      v_updated := v_updated + 1;
      v_last_end := v_last_end + make_interval(mins => v_duration);
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_wrote_slots, v_updated;
END;
$$;