-- Add dependency_group to export_scheduler_input output for parallel processing
-- This allows the scheduler to respect synchronization points between cover/text workflows
-- Simplified version without division filtering since that column may not exist

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
              'dependency_group',     s.dependency_group,
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