-- URGENT: Exclude DTP and Proof stages from scheduler completely
-- These stages should never be scheduled - they happen BEFORE production scheduling kicks in

-- Step 1: Update v_scheduler_stages_ready to exclude DTP stage group
DROP VIEW IF EXISTS public.v_scheduler_stages_ready;

CREATE VIEW public.v_scheduler_stages_ready AS
SELECT 
  jsi.*,
  ps.name as stage_name,
  COALESCE(sg.name, 'Default') as stage_group
FROM public.job_stage_instances jsi
JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
LEFT JOIN public.stage_groups sg ON ps.stage_group_id = sg.id
JOIN public.production_jobs pj ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
WHERE jsi.status IN ('pending', 'scheduled')
  AND jsi.job_table_name = 'production_jobs'
  -- CRITICAL: Only include proof-approved jobs
  AND pj.proof_approved_at IS NOT NULL
  AND ps.is_active = true
  -- URGENT FIX: Exclude DTP stage group completely
  AND LOWER(COALESCE(sg.name, '')) != 'dtp'
  -- Also exclude individual proof stages
  AND LOWER(ps.name) NOT LIKE '%proof%';

-- Step 2: Clean up any existing DTP/Proof slots from stage_time_slots
DELETE FROM public.stage_time_slots sts
USING public.production_stages ps
LEFT JOIN public.stage_groups sg ON sg.id = ps.stage_group_id
WHERE sts.production_stage_id = ps.id
  AND COALESCE(sts.is_completed, false) = false
  AND (
    LOWER(COALESCE(sg.name, '')) = 'dtp'
    OR LOWER(ps.name) LIKE '%proof%'
  );

-- Step 3: Update export_scheduler_input to exclude DTP stages from the data it returns
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

-- Step 4: Update scheduler_reschedule_all_parallel_aware to exclude DTP stages and add division support
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware();

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(p_division text DEFAULT NULL)
 RETURNS TABLE(updated_jsi integer, wrote_slots integer, violations text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  stage_record RECORD;
  job_record RECORD;
  base_time timestamptz;
  slot_start timestamptz;
  slot_end timestamptz;
  day_start timestamptz;
  day_end timestamptz;
  lunch_start timestamptz;
  lunch_end timestamptz;
  working_date date;
  total_updated integer := 0;
  total_slots integer := 0;
  violation_list text[] := '{}';
  dtp_stages_excluded integer := 0;
  dtp_slots_deleted integer := 0;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 42);
  
  RAISE NOTICE '=== SCHEDULER START: Division=%, Time=%===', COALESCE(p_division, 'ALL'), now();
  
  -- CRITICAL: Clean up any existing DTP/Proof slots first
  WITH deleted_slots AS (
    DELETE FROM stage_time_slots sts
    USING production_stages ps
    LEFT JOIN stage_groups sg ON sg.id = ps.stage_group_id
    WHERE sts.production_stage_id = ps.id
      AND COALESCE(sts.is_completed, false) = false
      AND (
        LOWER(COALESCE(sg.name, '')) = 'dtp'
        OR LOWER(ps.name) LIKE '%proof%'
      )
    RETURNING sts.id
  )
  SELECT COUNT(*) INTO dtp_slots_deleted FROM deleted_slots;
  
  RAISE NOTICE 'Pre-cleanup: Deleted % DTP/Proof slots', dtp_slots_deleted;
  
  -- Start scheduling from next working day at 8 AM
  working_date := CURRENT_DATE + interval '1 day';
  
  -- Find next working day (skip weekends and holidays)
  WHILE EXTRACT(dow FROM working_date) IN (0, 6) OR EXISTS (
    SELECT 1 FROM public_holidays WHERE date = working_date::date AND is_active = true
  ) LOOP
    working_date := working_date + interval '1 day';
  END LOOP;
  
  base_time := working_date + time '08:00:00';
  
  RAISE NOTICE 'Base scheduling time: % (next working day)', base_time;
  
  -- Clear all existing schedules for pending stages
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE status = 'pending';
  
  -- Clear all existing non-completed time slots
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  
  -- Create stage availability tracker
  CREATE TEMP TABLE IF NOT EXISTS stage_availability (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
  
  -- Initialize stage availability for all active non-DTP stages
  INSERT INTO stage_availability (stage_id, next_available_time)
  SELECT ps.id, base_time
  FROM production_stages ps
  LEFT JOIN stage_groups sg ON sg.id = ps.stage_group_id
  WHERE ps.is_active = true
    AND LOWER(COALESCE(sg.name, '')) != 'dtp'
    AND LOWER(ps.name) NOT LIKE '%proof%'
  ON CONFLICT (stage_id) DO UPDATE SET next_available_time = EXCLUDED.next_available_time;
  
  -- Process jobs in FIFO order: proof_approved_at first, then created_at as fallback
  FOR job_record IN
    SELECT DISTINCT 
      jsi.job_id,
      pj.wo_no,
      pj.division,
      COALESCE(pj.proof_approved_at, pj.created_at) as priority_timestamp
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status = 'pending'
      AND pj.proof_approved_at IS NOT NULL
      AND (p_division IS NULL OR pj.division = p_division)
    ORDER BY priority_timestamp ASC NULLS LAST
  LOOP
    RAISE NOTICE 'Processing job % (division: %, priority: %)', job_record.wo_no, job_record.division, job_record.priority_timestamp;
    
    -- Process stages for this job in stage_order, EXCLUDING DTP and Proof stages
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.stage_order,
        COALESCE(jsi.estimated_duration_minutes, 60) as duration_minutes,
        ps.name as stage_name,
        COALESCE(sg.name, 'Default') as stage_group
      FROM job_stage_instances jsi
      JOIN production_stages ps ON jsi.production_stage_id = ps.id
      LEFT JOIN stage_groups sg ON sg.id = ps.stage_group_id
      WHERE jsi.job_id = job_record.job_id
        AND jsi.job_table_name = 'production_jobs'  
        AND jsi.status = 'pending'
        -- CRITICAL: Exclude DTP and Proof stages
        AND LOWER(COALESCE(sg.name, '')) != 'dtp'
        AND LOWER(ps.name) NOT LIKE '%proof%'
      ORDER BY jsi.stage_order
    LOOP
      -- Get next available time for this stage
      SELECT next_available_time INTO slot_start
      FROM stage_availability 
      WHERE stage_id = stage_record.production_stage_id;
      
      -- If stage not in availability tracker, skip it (shouldn't happen but safety check)
      IF slot_start IS NULL THEN
        RAISE WARNING 'Stage % (%) not in availability tracker, skipping', stage_record.stage_name, stage_record.production_stage_id;
        CONTINUE;
      END IF;
      
      -- Simple working hours check: ensure we're within 8:00-12:00 or 12:30-16:30
      WHILE TRUE LOOP
        day_start := slot_start::date + time '08:00:00';
        day_end := slot_start::date + time '16:30:00';
        lunch_start := slot_start::date + time '12:00:00';
        lunch_end := slot_start::date + time '12:30:00';
        
        -- If we're before working hours, move to start of day
        IF slot_start < day_start THEN
          slot_start := day_start;
        END IF;
        
        -- If we're in lunch break, move to after lunch
        IF slot_start >= lunch_start AND slot_start < lunch_end THEN
          slot_start := lunch_end;
        END IF;
        
        -- Calculate slot end
        slot_end := slot_start + make_interval(mins => stage_record.duration_minutes);
        
        -- Check if job fits in current day
        IF slot_end <= day_end AND (slot_end <= lunch_start OR slot_start >= lunch_end) THEN
          -- Fits in current working day
          EXIT;
        ELSIF slot_start < lunch_start AND slot_end > lunch_start THEN
          -- Would cross lunch break - schedule after lunch
          slot_start := lunch_end;
          slot_end := slot_start + make_interval(mins => stage_record.duration_minutes);
          IF slot_end <= day_end THEN
            EXIT;
          END IF;
        END IF;
        
        -- Move to next working day
        working_date := (slot_start::date + interval '1 day');
        WHILE EXTRACT(dow FROM working_date) IN (0, 6) OR EXISTS (
          SELECT 1 FROM public_holidays WHERE date = working_date::date AND is_active = true
        ) LOOP
          working_date := working_date + interval '1 day';
        END LOOP;
        slot_start := working_date + time '08:00:00';
      END LOOP;
      
      -- Update job stage instance with schedule
      UPDATE job_stage_instances 
      SET 
        scheduled_start_at = slot_start,
        scheduled_end_at = slot_end,
        scheduled_minutes = stage_record.duration_minutes,
        schedule_status = 'scheduled',
        updated_at = now()
      WHERE id = stage_record.id;
      
      -- Create time slot
      INSERT INTO stage_time_slots (
        production_stage_id,
        job_id,
        stage_instance_id,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        job_table_name
      ) VALUES (
        stage_record.production_stage_id,
        job_record.job_id,
        stage_record.id,
        slot_start,
        slot_end,
        stage_record.duration_minutes,
        'production_jobs'
      );
      
      -- Update stage availability
      UPDATE stage_availability 
      SET next_available_time = slot_end
      WHERE stage_id = stage_record.production_stage_id;
      
      total_updated := total_updated + 1;
      total_slots := total_slots + 1;
      
      RAISE NOTICE 'Scheduled % [%] for job % from % to % (duration: %min)', 
        stage_record.stage_name, stage_record.stage_group, job_record.wo_no, 
        slot_start, slot_end, stage_record.duration_minutes;
    END LOOP;
  END LOOP;
  
  DROP TABLE IF EXISTS stage_availability;
  
  RAISE NOTICE '=== SCHEDULER COMPLETE: % stages updated, % slots created, % DTP stages excluded ===', 
    total_updated, total_slots, dtp_stages_excluded;
  
  RETURN QUERY SELECT total_updated, total_slots, violation_list;
END;
$function$;

-- Step 5: Update simple_scheduler_wrapper to support division parameter
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_division text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result RECORD;
  validation_results jsonb;
BEGIN
  RAISE NOTICE 'Simple scheduler wrapper called for division: %', COALESCE(p_division, 'ALL');
  
  -- Call the parallel-aware scheduler with division filter
  SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware(p_division);
  
  -- Get validation results
  SELECT jsonb_agg(
    jsonb_build_object(
      'job_id', v.job_id,
      'violation_type', v.violation_type,
      'stage1_name', v.stage1_name,
      'stage1_order', v.stage1_order,
      'stage2_name', v.stage2_name,
      'stage2_order', v.stage2_order,
      'violation_details', v.violation_details
    )
  ) INTO validation_results
  FROM public.validate_job_scheduling_precedence() v;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_jsi', result.updated_jsi,
    'wrote_slots', result.wrote_slots,
    'violations', COALESCE(validation_results, '[]'::jsonb)
  );
END;
$function$;