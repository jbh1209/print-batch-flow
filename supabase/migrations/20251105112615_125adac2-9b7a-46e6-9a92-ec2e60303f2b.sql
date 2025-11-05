-- Fix scheduler_resource_fill_optimized to use production_stage_id instead of resource_id
-- and add required duration_minutes and date columns to stage_time_slots INSERT

DROP FUNCTION IF EXISTS public.scheduler_resource_fill_optimized();

CREATE OR REPLACE FUNCTION public.scheduler_resource_fill_optimized()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _updated_jsi int := 0;
  _wrote_slots int := 0;
  _base_start timestamptz;
BEGIN
  _base_start := (CURRENT_DATE + INTERVAL '1 day' + TIME '08:00:00') AT TIME ZONE 'Africa/Johannesburg';

  CREATE TEMP TABLE _job_stage_ends (
    jsi_id uuid PRIMARY KEY,
    part_assignment text,
    end_time timestamptz
  );

  WITH stage_queue AS (
    SELECT
      jsi.id AS jsi_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.stage_order,
      jsi.part_assignment,
      ps.name AS stage_name,
      public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) + COALESCE(jsi.setup_time_minutes, 0) AS total_minutes,
      j.proof_approved_at
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    JOIN production_jobs j ON j.id = jsi.job_id
    WHERE j.status = 'In Production'
      AND jsi.completed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM stage_time_slots sts WHERE sts.stage_instance_id = jsi.id
      )
      AND ps.name NOT ILIKE '%proof%'
      AND ps.name NOT ILIKE '%dtp%'
    ORDER BY j.proof_approved_at NULLS LAST, jsi.stage_order
  ),
  resource_avail AS (
    SELECT
      sq.production_stage_id,
      COALESCE(MAX(sts.slot_end_time), _base_start) AS next_available
    FROM stage_queue sq
    LEFT JOIN stage_time_slots sts ON sts.production_stage_id = sq.production_stage_id
    GROUP BY sq.production_stage_id
  )
  INSERT INTO _job_stage_ends (jsi_id, part_assignment, end_time)
  SELECT
    sq.jsi_id,
    sq.part_assignment,
    ra.next_available + (sq.total_minutes || ' minutes')::interval
  FROM stage_queue sq
  JOIN resource_avail ra ON ra.production_stage_id = sq.production_stage_id;

  WITH placement AS (
    SELECT
      jse.jsi_id,
      jsi.production_stage_id,
      jsi.stage_order,
      jsi.part_assignment,
      GREATEST(
        _base_start,
        (
          SELECT MAX(pred.end_time)
          FROM _job_stage_ends pred
          JOIN job_stage_instances pred_jsi ON pred_jsi.id = pred.jsi_id
          WHERE pred_jsi.job_id = jsi.job_id
            AND pred_jsi.stage_order < jsi.stage_order
            AND (
              jsi.part_assignment = 'both'
              OR pred.part_assignment = 'both'
              OR pred.part_assignment = jsi.part_assignment
            )
        )
      ) AS stage_earliest_start,
      jse.end_time AS stage_earliest_end
    FROM _job_stage_ends jse
    JOIN job_stage_instances jsi ON jsi.id = jse.jsi_id
  )
  UPDATE job_stage_instances jsi
  SET
    scheduled_start_at = p.stage_earliest_start,
    scheduled_end_at = p.stage_earliest_end
  FROM placement p
  WHERE jsi.id = p.jsi_id;

  GET DIAGNOSTICS _updated_jsi = ROW_COUNT;

  WITH new_slots AS (
    SELECT
      jse.jsi_id AS stage_instance_id,
      jsi.production_stage_id,
      jsi.scheduled_start_at AS slot_start_time,
      jsi.scheduled_end_at AS slot_end_time,
      EXTRACT(EPOCH FROM (jsi.scheduled_end_at - jsi.scheduled_start_at)) / 60 AS duration_minutes,
      DATE(jsi.scheduled_start_at AT TIME ZONE 'Africa/Johannesburg') AS date
    FROM _job_stage_ends jse
    JOIN job_stage_instances jsi ON jsi.id = jse.jsi_id
    WHERE jsi.scheduled_start_at IS NOT NULL
  )
  INSERT INTO stage_time_slots (stage_instance_id, production_stage_id, slot_start_time, slot_end_time, duration_minutes, date)
  SELECT stage_instance_id, production_stage_id, slot_start_time, slot_end_time, duration_minutes, date
  FROM new_slots
  ON CONFLICT (stage_instance_id, slot_start_time) DO NOTHING;

  GET DIAGNOSTICS _wrote_slots = ROW_COUNT;

  DROP TABLE _job_stage_ends;

  RETURN jsonb_build_object(
    'updated_jsi', _updated_jsi,
    'wrote_slots', _wrote_slots
  );
END;
$$;