-- Add proof-approval filter so scheduler only picks up jobs with client approval
-- Fix: scheduler was scheduling ALL jobs instead of just proof-approved ones

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
  -- Iterate jobs in FIFO by proof/manually approved time, fallback created_at
  -- NOW WITH PROOF-APPROVAL FILTER
  FOR job_rec IN
    SELECT jsi.job_id,
           COALESCE(
             max(jsi.proof_approved_manually_at),
             max(jsi.proof_emailed_at),
             max(jsi.created_at)
           ) AS job_anchor
    FROM public.job_stage_instances jsi
    WHERE (p_job_ids IS NULL OR jsi.job_id = ANY(p_job_ids))
      AND (jsi.proof_approved_manually_at IS NOT NULL OR jsi.proof_emailed_at IS NOT NULL)
    GROUP BY jsi.job_id
    ORDER BY job_anchor NULLS LAST
  LOOP
    v_last_end := NULL;

    -- Stages within job, ordered
    FOR stage_rec IN
      SELECT jsi.id,
             jsi.stage_order,
             jsi.estimated_duration_minutes,
             jsi.scheduled_start_at,
             jsi.scheduled_end_at,
             jsi.proof_approved_manually_at,
             jsi.proof_emailed_at
      FROM public.job_stage_instances jsi
      JOIN public.production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = job_rec.job_id
        AND NOT (ps.name ILIKE '%PROOF%' OR ps.name ILIKE '%DTP%')
        AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
        AND jsi.completed_at IS NULL
      ORDER BY jsi.stage_order NULLS LAST, jsi.created_at
    LOOP
      v_base := COALESCE(stage_rec.proof_approved_manually_at, stage_rec.proof_emailed_at, now());
      IF v_last_end IS NULL OR v_last_end < v_base THEN
        v_last_end := v_base;
      END IF;

      v_duration := COALESCE(NULLIF(stage_rec.estimated_duration_minutes, 0), 60);

      UPDATE public.job_stage_instances jsi
      SET scheduled_start_at = v_last_end,
          scheduled_end_at   = v_last_end + make_interval(mins => v_duration),
          scheduled_minutes  = v_duration,
          schedule_status    = 'scheduled',
          updated_at         = now()
      WHERE jsi.id = stage_rec.id;

      v_updated := v_updated + 1;
      v_last_end := v_last_end + make_interval(mins => v_duration);
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_wrote_slots, v_updated;
END;
$$;