-- Fix the stage dependency enforcement trigger to exclude DTP and Proof stages
-- This will prevent dependency violations for stages that should be excluded from scheduling

CREATE OR REPLACE FUNCTION public.enforce_stage_dependencies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_job_id       uuid;
  v_stage_order  int;
  v_prev_end     timestamptz;
  v_stage_name   text;
begin
  -- Resolve the job, stage order, and stage name
  select jsi.job_id, coalesce(jsi.stage_order, 9999), ps.name
    into v_job_id, v_stage_order, v_stage_name
  from public.job_stage_instances jsi
  join public.production_stages ps on ps.id = jsi.production_stage_id
  where jsi.id = new.stage_instance_id;

  -- CRITICAL FIX: Skip dependency validation for DTP and Proof stages
  -- These stages are excluded from the main scheduling workflow
  if v_stage_name ilike '%DTP%' or v_stage_name ilike '%proof%' then
    return new;
  end if;

  -- Latest end among all earlier stages for the same job
  -- Also exclude DTP and Proof stages from the dependency check
  select max(sts.slot_end_time)
    into v_prev_end
  from public.job_stage_instances jsi2
  join public.stage_time_slots     sts  on sts.stage_instance_id = jsi2.id
  join public.production_stages    ps2  on ps2.id = jsi2.production_stage_id
  where jsi2.job_id = v_job_id
    and coalesce(jsi2.stage_order, 9999) < v_stage_order
    -- CRITICAL FIX: Exclude DTP and Proof stages from dependency calculations
    and ps2.name not ilike '%DTP%' 
    and ps2.name not ilike '%proof%';

  if v_prev_end is not null and new.slot_start_time < v_prev_end then
    raise exception
      'Dependency violation: stage % for job % starts at %, but previous stages end at %',
      new.stage_instance_id, v_job_id, new.slot_start_time, v_prev_end;
  end if;

  return new;
end
$function$;