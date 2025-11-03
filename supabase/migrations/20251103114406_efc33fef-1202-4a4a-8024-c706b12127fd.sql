-- Fix scheduler_append_jobs to consider ALL slots when initializing stage tails
-- Previous migration incorrectly filtered to only completed slots, causing new jobs to fill gaps instead of tailing

CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(p_job_ids uuid[], p_only_if_unset boolean DEFAULT true)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  r_stage record;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  resource_available_time timestamptz;
BEGIN
  -- Get factory base time for scheduling
  base_time := public.next_working_start(now());
  
  RAISE NOTICE 'Starting append-only scheduler for % jobs from: %', array_length(p_job_ids, 1), base_time;

  -- Create temporary stage availability tracker
  PERFORM public.create_stage_availability_tracker();
  
  -- Initialize resource availability from existing slots (completed OR scheduled)
  -- FIXED: Removed is_completed filter to consider ALL existing slots
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    production_stage_id, 
    COALESCE(MAX(slot_end_time), base_time)
  FROM stage_time_slots 
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  -- Initialize any untracked stages
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE jsi.job_id = ANY(p_job_ids)
  ON CONFLICT (stage_id) DO NOTHING;

  -- Process pending stages for specified jobs in order
  FOR r_stage IN
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.stage_order,
      public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes,
      ps.name as stage_name,
      pj.proof_approved_at,
      pj.wo_no
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    JOIN production_jobs pj ON pj.id = jsi.job_id
    WHERE jsi.job_id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NOT NULL
      AND jsi.status = 'pending'
      AND ps.name NOT ILIKE '%dtp%'
      AND ps.name NOT ILIKE '%proof%'
      AND ps.name NOT ILIKE '%batch%'
      AND (NOT p_only_if_unset OR jsi.scheduled_start_at IS NULL)
    ORDER BY pj.proof_approved_at ASC, jsi.stage_order ASC
  LOOP
    RAISE NOTICE 'Appending stage % for job % (WO: %): % mins',
      r_stage.stage_name, r_stage.job_id, r_stage.wo_no, r_stage.duration_minutes;

    -- Get current resource availability
    SELECT next_available_time INTO resource_available_time
    FROM _stage_tails 
    WHERE stage_id = r_stage.production_stage_id
    FOR UPDATE;

    -- Schedule from resource availability or job approval time, whichever is later
    resource_available_time := GREATEST(resource_available_time, r_stage.proof_approved_at, base_time);

    -- Place duration starting from resource availability
    SELECT * INTO placement_result
    FROM public.place_duration_sql(resource_available_time, r_stage.duration_minutes, 60);
    
    IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
      RAISE EXCEPTION 'FAILED to append stage % for job % - placement failed at %',
        r_stage.stage_name, r_stage.job_id, resource_available_time;
    END IF;

    -- Create time slots
    FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
    LOOP
      INSERT INTO stage_time_slots(
        production_stage_id,
        date,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        job_id,
        job_table_name,
        stage_instance_id,
        is_completed
      )
      VALUES (
        r_stage.production_stage_id,
        (slot_record ->> 'date')::date,
        (slot_record ->> 'start_time')::timestamptz,
        (slot_record ->> 'end_time')::timestamptz,
        (slot_record ->> 'duration_minutes')::integer,
        r_stage.job_id,
        'production_jobs',
        r_stage.stage_instance_id,
        false
      );
      wrote_count := wrote_count + 1;
    END LOOP;

    -- Calculate stage end time
    SELECT MAX((time_slot ->> 'end_time')::timestamptz)
    INTO stage_end_time
    FROM jsonb_array_elements(placement_result.slots_created) time_slot;

    -- Update resource availability
    UPDATE _stage_tails 
    SET next_available_time = stage_end_time
    WHERE stage_id = r_stage.production_stage_id;

    -- Update job stage instance
    UPDATE job_stage_instances
    SET 
      scheduled_minutes = r_stage.duration_minutes,
      scheduled_start_at = (
        SELECT MIN((time_slot ->> 'start_time')::timestamptz)
        FROM jsonb_array_elements(placement_result.slots_created) time_slot
      ),
      scheduled_end_at = stage_end_time,
      schedule_status = 'scheduled',
      updated_at = now()
    WHERE id = r_stage.stage_instance_id;
    updated_count := updated_count + 1;

    RAISE NOTICE 'Completed appending stage % - ends at %', r_stage.stage_name, stage_end_time;
  END LOOP;

  -- Run validation
  SELECT jsonb_agg(to_jsonb(v)) INTO validation_results
  FROM public.validate_job_scheduling_precedence() v;

  RAISE NOTICE 'Append scheduler completed: % time slots written, % job stages updated',
    wrote_count, updated_count;

  RETURN QUERY SELECT wrote_count, updated_count, COALESCE(validation_results, '[]'::jsonb);
END;
$function$;