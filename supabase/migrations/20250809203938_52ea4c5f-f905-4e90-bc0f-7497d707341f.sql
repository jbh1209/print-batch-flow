-- 1) Enable required extensions (idempotent)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- 2) Add scheduling fields to job_stage_instances
alter table public.job_stage_instances
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists scheduled_minutes integer default 0,
  add column if not exists schedule_status text default 'unscheduled',
  add column if not exists queue_position integer;

-- Helpful indexes
create index if not exists idx_jsi_stage_scheduled_start on public.job_stage_instances (production_stage_id, scheduled_start_at);
create index if not exists idx_jsi_stage_scheduled_end on public.job_stage_instances (production_stage_id, scheduled_end_at);
create index if not exists idx_jsi_stage_status on public.job_stage_instances (production_stage_id, schedule_status);
create index if not exists idx_jsi_job_order on public.job_stage_instances (job_id, stage_order);

-- 3) Add tentative_due_date to production_jobs
alter table public.production_jobs
  add column if not exists tentative_due_date date;

-- 4) Trigger to schedule on proof approval
create or replace function public.trigger_schedule_on_proof_approval()
returns trigger
language plpgsql
security definer
as $$
declare
  is_proof boolean;
  req_id uuid;
begin
  -- Only when proof approved transitions from NULL to NOT NULL
  if new.proof_approved_manually_at is not null and (old.proof_approved_manually_at is null) then
    -- Check this stage is a Proof stage by name
    select ps.name ilike '%proof%' into is_proof
    from public.production_stages ps
    where ps.id = new.production_stage_id;

    if coalesce(is_proof, false) then
      -- Fire-and-forget call to edge function (public function, handles auth internally)
      select net.http_post(
        url := 'https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/schedule-on-approval',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object('job_id', new.job_id, 'job_table_name', new.job_table_name)
      ) into req_id;
    end if;
  end if;
  return new;
end;
$$;

-- Drop existing trigger if present to avoid duplicates
drop trigger if exists trg_schedule_on_proof_approval on public.job_stage_instances;

create trigger trg_schedule_on_proof_approval
after update of proof_approved_manually_at on public.job_stage_instances
for each row execute function public.trigger_schedule_on_proof_approval();

-- 5) Nightly cron to recalc tentative due dates at 00:05 (server time)
-- Unschedule if exists
do $$
begin
  if exists (select 1 from cron.job where jobname = 'recalc-tentative-due-dates-nightly') then
    perform cron.unschedule('recalc-tentative-due-dates-nightly');
  end if;
end $$;

select cron.schedule(
  'recalc-tentative-due-dates-nightly',
  '5 0 * * *',
  $$
  select
    net.http_post(
        url:='https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/recalc-tentative-due-dates',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
