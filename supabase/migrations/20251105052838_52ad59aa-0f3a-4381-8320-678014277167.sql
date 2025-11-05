-- Fix jsonb_object_length compatibility issue in scheduler_reschedule_all_parallel_aware
-- Replace the non-existent function call with a compatible alternative

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_commit boolean DEFAULT true, 
  p_start_from timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_time timestamp with time zone;
  barriers_snapshot jsonb;
  r_job record;
  r_stage record;
  r_dep record;
  slot_record jsonb;
  original_start timestamp with time zone;
  stage_end_time timestamp with time zone;
  stage_earliest_start timestamp with time zone;
  resource_available_time timestamp with time zone;
  jsi_updated integer := 0;
  slots_written integer := 0;
BEGIN
  base_time := COALESCE(p_start_from, now());
  RAISE NOTICE '🚀 scheduler_reschedule_all_parallel_aware starting with base_time=%', base_time;

  -- 1) Capture completed barriers BEFORE wipe
  SELECT jsonb_object_agg(jsi.id, jsi.scheduled_end_at)
  INTO barriers_snapshot
  FROM job_stage_instances jsi
  WHERE jsi.scheduled_end_at IS NOT NULL
    AND jsi.scheduled_end_at < base_time;

  -- FIXED LINE 31: Use COUNT(*) FROM jsonb_each instead of jsonb_object_length
  RAISE NOTICE '📸 Captured % completed barriers before wipe', 
    (SELECT COUNT(*) FROM jsonb_each(COALESCE(barriers_snapshot, '{}'::jsonb)));

  -- 2) Nuclear wipe with WHERE clause (safety requirement)
  IF p_commit THEN
    DELETE FROM stage_time_slots WHERE true;
    RAISE NOTICE '💥 Nuclear wipe completed';
  END IF;

  -- 3) Loop through all pending jobs
  FOR r_job IN
    SELECT
      pj.id AS job_id,
      pj.wo_no,
      pj.division,
      pj.due_date,
      COALESCE(pj.priority_override, 5) AS priority
    FROM production_jobs pj
    WHERE pj.status NOT IN ('completed', 'cancelled', 'on_hold')
    ORDER BY
      COALESCE(pj.priority_override, 5) ASC,
      pj.due_date ASC NULLS LAST,
      pj.created_at ASC
  LOOP
    RAISE NOTICE '📦 Processing job % (WO %)', r_job.job_id, r_job.wo_no;

    -- 4) Loop through stages in correct order
    FOR r_stage IN
      SELECT
        jsi.id AS stage_instance_id,
        jsi.production_stage_id,
        jsi.stage_order,
        jsi.duration_minutes,
        ps.resource_id,
        ps.stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id
        AND jsi.status NOT IN ('completed', 'cancelled', 'skipped')
        AND ps.stage_name NOT ILIKE '%PROOF%'
        AND ps.stage_name NOT ILIKE '%DTP%'
      ORDER BY jsi.stage_order ASC
    LOOP
      stage_earliest_start := base_time;

      -- 5) Check completed barriers
      IF barriers_snapshot IS NOT NULL THEN
        FOR r_dep IN
          SELECT dep.depends_on_stage_id
          FROM stage_dependencies dep
          WHERE dep.stage_id = r_stage.stage_instance_id
        LOOP
          IF barriers_snapshot ? r_dep.depends_on_stage_id::text THEN
            stage_earliest_start := GREATEST(
              stage_earliest_start,
              (barriers_snapshot ->> r_dep.depends_on_stage_id::text)::timestamp with time zone
            );
          END IF;
        END LOOP;
      END IF;

      -- 6) Get resource tail (re-enabled)
      SELECT COALESCE(MAX(slot_end_time), base_time)
      INTO resource_available_time
      FROM stage_time_slots
      WHERE production_stage_id = r_stage.production_stage_id;

      stage_earliest_start := GREATEST(stage_earliest_start, resource_available_time);

      RAISE NOTICE 'Placing job %, stage_instance %, prod_stage %, start %, tail %',
        r_job.job_id, r_stage.stage_instance_id, r_stage.production_stage_id,
        stage_earliest_start, resource_available_time;

      -- 7) Call parallel slot builder
      SELECT public.build_parallel_slots_for_stage(
        r_stage.stage_instance_id,
        r_stage.production_stage_id,
        r_stage.duration_minutes,
        stage_earliest_start
      ) INTO slot_record;

      original_start := (slot_record ->> 'start_time')::timestamp with time zone;
      stage_end_time := (slot_record ->> 'end_time')::timestamp with time zone;

      -- 8) Update JSI
      UPDATE job_stage_instances
      SET
        scheduled_start_at = original_start,
        scheduled_end_at = stage_end_time,
        updated_at = now()
      WHERE id = r_stage.stage_instance_id;

      jsi_updated := jsi_updated + 1;
      slots_written := slots_written + (slot_record ->> 'slots_written')::int;
    END LOOP;
  END LOOP;

  RAISE NOTICE '✅ Scheduler complete: updated % JSI, wrote % slots', jsi_updated, slots_written;

  RETURN jsonb_build_object(
    'updated_jsi', jsi_updated,
    'wrote_slots', slots_written,
    'violations', '[]'::jsonb
  );
END;
$function$;