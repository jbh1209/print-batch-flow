-- Fix nuclear parameter: Add to scheduler function signature and make DELETE conditional

-- 1. Update scheduler_reschedule_all_parallel_aware with p_nuclear parameter
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_start_from TIMESTAMPTZ DEFAULT NULL,
  p_division TEXT DEFAULT NULL,
  p_nuclear BOOLEAN DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  base_time TIMESTAMPTZ;
  _stage_tails jsonb;
  _job record;
  _stage record;
  earliest TIMESTAMPTZ;
  tail_arr jsonb;
  best_slot TIMESTAMPTZ;
  depth INT := 0;
  scheduled_count INT := 0;
  considered_count INT := 0;
BEGIN
  base_time := COALESCE(p_start_from, now());
  RAISE NOTICE '🔄 RESCHEDULE_ALL starting from % for division %', base_time, COALESCE(p_division, 'ALL');

  -- Build stage tails with SURGICAL DIVISION FILTER
  SELECT jsonb_object_agg(jsi.id::text, arr)
  INTO _stage_tails
  FROM job_stage_instances jsi
  INNER JOIN production_stages ps ON ps.id = jsi.production_stage_id
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', pred_jsi.id::text,
        'tail', COALESCE(
          (SELECT MAX(sts.slot_end_time)
           FROM stage_time_slots sts
           WHERE sts.stage_instance_id = pred_jsi.id
             AND COALESCE(sts.is_completed, false) = false),
          base_time
        )
      )
    )
    FROM jsonb_array_elements_text(COALESCE(ps.predecessor_stage_ids, '[]'::jsonb)) AS pred_id(text_val)
    INNER JOIN job_stage_instances pred_jsi
      ON pred_jsi.production_stage_id = pred_id.text_val::uuid
      AND pred_jsi.job_id = jsi.job_id
  ) AS arr(arr)
  WHERE jsi.status = 'pending'
    AND (p_division IS NULL OR ps.division = p_division);

  RAISE NOTICE '📊 Built stage_tails with % keys', jsonb_object_keys(_stage_tails);

  -- SURGICAL DIVISION FILTER: Nuclear cleanup (only if p_nuclear=true)
  IF p_nuclear THEN
    DELETE FROM stage_time_slots sts
    USING production_stages ps
    WHERE sts.production_stage_id = ps.id
      AND COALESCE(sts.is_completed, false) = false
      AND sts.slot_start_time >= base_time
      AND (p_division IS NULL OR ps.division = p_division);
    RAISE NOTICE '🔥 NUCLEAR: Deleted all non-completed slots for division % from %', p_division, base_time;
  END IF;

  FOR _job IN
    SELECT DISTINCT
      j.id AS job_id,
      j.proof_approved_at,
      j.created_at
    FROM production_jobs j
    INNER JOIN job_stage_instances jsi ON jsi.job_id = j.id
    INNER JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.status = 'pending'
      AND j.status NOT IN ('Cancelled', 'Completed')
      AND ps.stage_type NOT IN ('DTP', 'PROOF')
      AND (p_division IS NULL OR ps.division = p_division)
    ORDER BY j.proof_approved_at NULLS LAST, j.created_at
  LOOP
    considered_count := considered_count + 1;
    RAISE NOTICE '🔍 [Job %] Considering job', _job.job_id;

    FOR _stage IN
      SELECT
        jsi.id AS instance_id,
        jsi.production_stage_id,
        ps.duration_minutes,
        ps.sequence_order,
        ps.predecessor_stage_ids,
        ps.max_parallel_capacity
      FROM job_stage_instances jsi
      INNER JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = _job.job_id
        AND jsi.status = 'pending'
        AND ps.stage_type NOT IN ('DTP', 'PROOF')
        AND (p_division IS NULL OR ps.division = p_division)
      ORDER BY ps.sequence_order
    LOOP
      earliest := base_time;
      tail_arr := (_stage_tails->>_stage.instance_id::text)::jsonb;

      IF tail_arr IS NOT NULL AND jsonb_array_length(tail_arr) > 0 THEN
        FOR depth IN 0..(jsonb_array_length(tail_arr)-1)
        LOOP
          earliest := GREATEST(earliest, (tail_arr->depth->>'tail')::timestamptz);
        END LOOP;
      END IF;

      SELECT slot_start FROM public.find_best_slot(
        _stage.production_stage_id,
        _stage.duration_minutes,
        earliest,
        base_time + interval '90 days',
        _stage.max_parallel_capacity,
        120
      ) INTO best_slot;

      IF best_slot IS NOT NULL THEN
        INSERT INTO stage_time_slots (
          production_stage_id,
          stage_instance_id,
          slot_start_time,
          slot_end_time,
          is_proposed
        )
        VALUES (
          _stage.production_stage_id,
          _stage.instance_id,
          best_slot,
          best_slot + (_stage.duration_minutes || ' minutes')::interval,
          false
        )
        ON CONFLICT (stage_instance_id, slot_start_time) DO NOTHING;

        scheduled_count := scheduled_count + 1;

        _stage_tails := jsonb_set(
          _stage_tails,
          ARRAY[_stage.instance_id::text],
          jsonb_build_array(
            jsonb_build_object(
              'id', _stage.instance_id::text,
              'tail', best_slot + (_stage.duration_minutes || ' minutes')::interval
            )
          )
        );
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ RESCHEDULE_ALL: considered=%, scheduled=%', considered_count, scheduled_count;

  RETURN jsonb_build_object(
    'jobs_considered', considered_count,
    'scheduled', scheduled_count,
    'applied', jsonb_build_object('updated', scheduled_count)
  );
END;
$$;

-- 2. Update simple_scheduler_wrapper to pass p_nuclear
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_commit BOOLEAN DEFAULT TRUE,
  p_proposed BOOLEAN DEFAULT FALSE,
  p_only_if_unset BOOLEAN DEFAULT TRUE,
  p_nuclear BOOLEAN DEFAULT FALSE,
  p_start_from TIMESTAMPTZ DEFAULT NULL,
  p_only_job_ids UUID[] DEFAULT NULL,
  p_division TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE '🎯 simple_scheduler_wrapper called: commit=%, nuclear=%, division=%', p_commit, p_nuclear, p_division;

  IF NOT p_commit THEN
    RAISE NOTICE '🔍 DRY RUN mode - returning stub result';
    RETURN jsonb_build_object(
      'jobs_considered', 0,
      'scheduled', 0,
      'applied', jsonb_build_object('updated', 0)
    );
  END IF;

  IF p_only_if_unset AND p_only_job_ids IS NOT NULL THEN
    RAISE NOTICE '📋 APPEND mode for specific jobs';
    SELECT * INTO result FROM public.scheduler_append_jobs(p_only_job_ids, COALESCE(p_start_from, now()), p_division);
  ELSE
    RAISE NOTICE '🔄 FULL RESCHEDULE mode';
    SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware(
      COALESCE(p_start_from, now()), 
      p_division,
      p_nuclear
    );
  END IF;

  RETURN result;
END;
$$;

-- 3. Update GRANT statements
GRANT EXECUTE ON FUNCTION public.scheduler_reschedule_all_parallel_aware(TIMESTAMPTZ, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.simple_scheduler_wrapper(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID[], TEXT) TO service_role;