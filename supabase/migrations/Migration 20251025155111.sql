-- Make scheduler functions division-aware (production_jobs filtering)

-- Update export_scheduler_input to filter by production_jobs.division
CREATE OR REPLACE FUNCTION public.export_scheduler_input(p_division text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
with
meta as (
  select
    now() at time zone 'utc' as generated_at,
    jsonb_build_array(jsonb_build_object('start_time','13:00:00','minutes',30)) as breaks
),
shifts as (
  select id, day_of_week, shift_start_time, shift_end_time, is_working_day
  from shift_schedules
  where coalesce(is_active, true) = true
),
holidays as (
  select date, name
  from public_holidays
  where coalesce(is_active, true) = true
),
proof_stage as (
  select coalesce(
    (select id from production_stages where lower(name)='proof' limit 1),
    'ea194968-3604-44a3-9314-d190bb5691c7'::uuid
  ) as id
),
approved_jobs as (
  select
    jsi.job_id,
    max(
      coalesce(
        jsi.proof_approved_manually_at,
        (select max(pl.responded_at)
           from proof_links pl
          where pl.stage_instance_id = jsi.id
            and lower(coalesce(pl.client_response,'')) in ('approved','accept','accepted')
        ),
        case when jsi.status = 'completed' then jsi.updated_at end
      )
    ) as approved_at
  from job_stage_instances jsi
  join proof_stage ps on ps.id = jsi.production_stage_id
  group by jsi.job_id
),
jobs as (
  select distinct vsr.job_id
  from public.v_scheduler_stages_ready vsr
  inner join production_jobs pj on pj.id = vsr.job_id
  where (p_division IS NULL OR pj.division = p_division)
),
jobs_json as (
  select jsonb_agg(
    jsonb_build_object(
      'job_id', j.job_id,
      'wo_number', j.job_id::text,
      'customer_name', '',
      'quantity', 0,
      'due_date', null,
      'proof_approved_at', aj.approved_at,
      'estimated_run_minutes', 0,
      'stages',
        (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id',                   s.id,
              'job_id',               s.job_id,
              'status',               s.status,
              'job_table',            s.job_table_name,
              'stage_name',           s.stage_name,
              'stage_group',          s.stage_group,
              'stage_order',
                case
                  when lower(coalesce(s.stage_group,'')) in ('printing','large format') then 10
                  when lower(coalesce(s.stage_group,'')) in ('uv varnishing','laminating','hunkeler','gathering','saddle stitching','finishing') then 20
                  when lower(coalesce(s.stage_group,'')) in ('packaging') then 30
                  when lower(coalesce(s.stage_group,'')) in ('shipping') then 40
                  else 50
                end,
              'setup_minutes',        s.setup_time_minutes,
              'estimated_minutes',    s.estimated_duration_minutes,
              'scheduled_start_at',   s.scheduled_start_at,
              'scheduled_end_at',     s.scheduled_end_at,
              'scheduled_minutes',    s.scheduled_minutes,
              'schedule_status',      s.schedule_status,
              'production_stage_id',  s.production_stage_id,
              'part_assignment',      s.part_assignment,
              'category_id',          s.category_id
            )
            order by 4, s.id
          ), '[]'::jsonb)
          from public.v_scheduler_stages_ready s
          where s.job_id = j.job_id
        )
    )
  ) as data
  from jobs j
  left join approved_jobs aj on aj.job_id = j.job_id
)
select jsonb_build_object(
  'meta',     (select jsonb_build_object('generated_at', generated_at, 'breaks', breaks) from meta),
  'shifts',   (select coalesce(jsonb_agg(to_jsonb(shifts)   order by day_of_week), '[]'::jsonb) from shifts),
  'holidays', (select coalesce(jsonb_agg(to_jsonb(holidays) order by date),       '[]'::jsonb) from holidays),
  'routes',   '[]'::jsonb,
  'jobs',     coalesce((select data from jobs_json), '[]'::jsonb)
);
$function$;

-- Update scheduler_reschedule_all_sequential_fixed to accept division parameter
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_sequential_fixed(
  p_start_from timestamp with time zone DEFAULT NULL,
  p_division text DEFAULT NULL
)
 RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_time timestamptz;
  wrote_count integer := 0;
  updated_count integer := 0;
  sync_count integer := 0;
  validation_results jsonb := '[]'::jsonb;
  clear_result record;
  r_job record;
  r_stage record;
  current_layer_order integer;
  layer_end_times timestamptz[];
  job_barriers JSONB := '{}'::jsonb;
  job_part_barriers JSONB := '{}'::jsonb;
  resource_available_time timestamptz;
  job_current_barrier timestamptz;
  stage_earliest_start timestamptz;
  placement_result record;
  slot_record jsonb;
  stage_end_time timestamptz;
  actual_start_time timestamptz;
  actual_end_time timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(1, 50);

  IF p_start_from IS NULL THEN
    base_time := public.next_working_start(date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day');
  ELSE
    base_time := public.next_working_start(p_start_from);
  END IF;

  IF base_time IS NULL THEN
    RAISE EXCEPTION 'Failed to determine valid base scheduling time';
  END IF;

  RAISE NOTICE 'DIVISION-AWARE Scheduler: Starting from % for division %', base_time, COALESCE(p_division, 'ALL');

  SELECT * INTO clear_result FROM public.clear_non_completed_scheduling_data();

  PERFORM public.create_stage_availability_tracker();
  
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT production_stage_id, GREATEST(COALESCE(MAX(slot_end_time), base_time), base_time)
  FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = true
  GROUP BY production_stage_id
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, _stage_tails.next_available_time);

  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT jsi.production_stage_id, base_time
  FROM job_stage_instances jsi
  WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
  ON CONFLICT (stage_id) DO NOTHING;

  FOR r_job IN
    SELECT pj.id as job_id, pj.proof_approved_at, pj.wo_no, pj.division, COUNT(jsi.id) as total_stages
    FROM production_jobs pj
    JOIN job_stage_instances jsi ON jsi.job_id = pj.id
    WHERE COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      AND pj.proof_approved_at IS NOT NULL
      AND (p_division IS NULL OR pj.division = p_division)
    GROUP BY pj.id, pj.proof_approved_at, pj.wo_no, pj.division
    ORDER BY pj.proof_approved_at ASC, pj.id ASC
  LOOP
    job_current_barrier := GREATEST(base_time, COALESCE(r_job.proof_approved_at, base_time));
    job_barriers := jsonb_set(job_barriers, ARRAY[r_job.job_id::text], to_jsonb(job_current_barrier));
    job_part_barriers := jsonb_set(job_part_barriers, ARRAY[r_job.job_id::text], '{"cover": null, "text": null, "both": null}'::jsonb);
    
    current_layer_order := -1;
    layer_end_times := ARRAY[]::timestamptz[];
    
    FOR r_stage IN
      SELECT jsi.id as stage_instance_id, jsi.production_stage_id, jsi.stage_order, jsi.part_assignment,
             public.jsi_minutes(jsi.scheduled_minutes, jsi.estimated_duration_minutes) as duration_minutes, ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.job_id = r_job.job_id AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
      ORDER BY COALESCE(jsi.stage_order, 999999) ASC, jsi.id ASC
    LOOP
      IF r_stage.stage_order != current_layer_order THEN
        IF array_length(layer_end_times, 1) > 0 THEN
          job_current_barrier := (SELECT MAX(t) FROM unnest(layer_end_times) AS t);
          job_barriers := jsonb_set(job_barriers, ARRAY[r_job.job_id::text], to_jsonb(job_current_barrier));
        END IF;
        current_layer_order := r_stage.stage_order;
        layer_end_times := ARRAY[]::timestamptz[];
        job_current_barrier := COALESCE((job_barriers ->> r_job.job_id::text)::timestamptz, base_time);
      END IF;
      
      IF r_stage.part_assignment = 'both' THEN
        DECLARE
          job_part_data jsonb;
          cover_end_time timestamptz;
          text_end_time timestamptz;
          convergence_barrier timestamptz;
        BEGIN
          job_part_data := job_part_barriers -> r_job.job_id::text;
          cover_end_time := COALESCE((job_part_data ->> 'cover')::timestamptz, job_current_barrier);
          text_end_time := COALESCE((job_part_data ->> 'text')::timestamptz, job_current_barrier);
          convergence_barrier := GREATEST(cover_end_time, text_end_time);
          job_current_barrier := convergence_barrier;
        END;
      END IF;
      
      SELECT next_available_time INTO resource_available_time
      FROM _stage_tails WHERE stage_id = r_stage.production_stage_id FOR UPDATE;
      resource_available_time := COALESCE(resource_available_time, base_time);
      stage_earliest_start := GREATEST(job_current_barrier, resource_available_time);

      SELECT * INTO placement_result FROM public.place_duration_sql(stage_earliest_start, r_stage.duration_minutes);
      
      IF NOT placement_result.placement_success OR placement_result.slots_created IS NULL THEN
        RAISE EXCEPTION 'Cannot schedule stage % for job %', r_stage.stage_name, r_job.job_id;
      END IF;

      FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
      LOOP
        INSERT INTO stage_time_slots(production_stage_id, date, slot_start_time, slot_end_time, duration_minutes, job_id, job_table_name, stage_instance_id, is_completed)
        VALUES (r_stage.production_stage_id, (slot_record ->> 'date')::date, (slot_record ->> 'start_time')::timestamptz, (slot_record ->> 'end_time')::timestamptz,
                (slot_record ->> 'duration_minutes')::integer, r_job.job_id, 'production_jobs', r_stage.stage_instance_id, false);
        wrote_count := wrote_count + 1;
      END LOOP;

      SELECT MIN((time_slot ->> 'start_time')::timestamptz), MAX((time_slot ->> 'end_time')::timestamptz)
      INTO actual_start_time, actual_end_time
      FROM jsonb_array_elements(placement_result.slots_created) time_slot;

      actual_start_time := COALESCE(actual_start_time, stage_earliest_start);
      actual_end_time := COALESCE(actual_end_time, actual_start_time + make_interval(mins => r_stage.duration_minutes));

      UPDATE _stage_tails SET next_available_time = actual_end_time WHERE stage_id = r_stage.production_stage_id;
      UPDATE job_stage_instances SET scheduled_minutes = r_stage.duration_minutes, scheduled_start_at = actual_start_time,
             scheduled_end_at = actual_end_time, schedule_status = 'scheduled', updated_at = now()
      WHERE id = r_stage.stage_instance_id;
      updated_count := updated_count + 1;

      IF r_stage.part_assignment IN ('cover', 'text') THEN
        job_part_barriers := jsonb_set(job_part_barriers, ARRAY[r_job.job_id::text, r_stage.part_assignment], to_jsonb(actual_end_time));
      END IF;

      layer_end_times := array_append(layer_end_times, actual_end_time);
    END LOOP;
    
    IF array_length(layer_end_times, 1) > 0 THEN
      job_current_barrier := (SELECT MAX(t) FROM unnest(layer_end_times) AS t);
      job_barriers := jsonb_set(job_barriers, ARRAY[r_job.job_id::text], to_jsonb(job_current_barrier));
    END IF;
  END LOOP;

  UPDATE job_stage_instances jsi
  SET scheduled_start_at = slot_times.actual_start, scheduled_end_at = slot_times.actual_end, updated_at = now()
  FROM (
    SELECT sts.stage_instance_id, MIN(sts.slot_start_time) as actual_start, MAX(sts.slot_end_time) as actual_end
    FROM stage_time_slots sts
    WHERE sts.stage_instance_id IS NOT NULL AND COALESCE(sts.is_completed, false) = false
    GROUP BY sts.stage_instance_id
  ) slot_times
  WHERE jsi.id = slot_times.stage_instance_id
    AND (jsi.scheduled_start_at != slot_times.actual_start OR jsi.scheduled_end_at != slot_times.actual_end OR
         jsi.scheduled_start_at IS NULL OR jsi.scheduled_end_at IS NULL);
  
  GET DIAGNOSTICS sync_count = ROW_COUNT;

  SELECT jsonb_agg(jsonb_build_object('job_id', v.job_id, 'violation_type', v.violation_type, 'stage1_name', v.stage1_name,
                                      'stage1_order', v.stage1_order, 'stage2_name', v.stage2_name, 'stage2_order', v.stage2_order,
                                      'violation_details', v.violation_details))
  INTO validation_results FROM public.validate_job_scheduling_precedence() v;

  RETURN QUERY SELECT wrote_count, updated_count, COALESCE(validation_results, '[]'::jsonb);
END;
$function$;