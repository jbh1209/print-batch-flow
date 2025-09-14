-- Fix the format() bug in enforce_stage_precedence_on_slot trigger
CREATE OR REPLACE FUNCTION public.enforce_stage_precedence_on_slot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  cur_jsi RECORD;
  pred_jsi RECORD;
  new_start timestamptz;
  pred_end timestamptz;
BEGIN
  -- If NEW.stage_instance_id is null, nothing we can check
  IF NEW.stage_instance_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO cur_jsi
  FROM public.job_stage_instances
  WHERE id = NEW.stage_instance_id;

  -- If stage instance not found, allow (avoid hard failure)
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Only enforce for production_jobs workflow (same behavior otherwise but safer to scope)
  IF cur_jsi.job_table_name IS NULL OR cur_jsi.job_table_name = '' THEN
    RETURN NEW;
  END IF;

  new_start := NEW.slot_start_time;

  -- Identify the immediate predecessor by stage_order
  SELECT jsi_prev.* INTO pred_jsi
  FROM public.job_stage_instances jsi_prev
  WHERE jsi_prev.job_id = cur_jsi.job_id
    AND jsi_prev.job_table_name = cur_jsi.job_table_name
    AND jsi_prev.stage_order < cur_jsi.stage_order
  ORDER BY jsi_prev.stage_order DESC
  LIMIT 1;

  IF pred_jsi IS NULL THEN
    -- No predecessor, nothing to enforce
    RETURN NEW;
  END IF;

  -- Determine predecessor end time (scheduled_end, completed_at, or estimated from start + est)
  SELECT public.get_actual_stage_end_time(pred_jsi.id) INTO pred_end;

  -- If predecessor ends after the new slot start time, block
  IF pred_end IS NOT NULL AND pred_end > new_start THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Precedence violation: cannot start stage_order ' || cur_jsi.stage_order || 
                ' at ' || new_start || ' before predecessor (order ' || pred_jsi.stage_order || 
                ') ends at ' || pred_end || ' [job: ' || cur_jsi.job_id || ']',
      DETAIL = 'stage_instance_id=' || cur_jsi.id || ' predecessor_id=' || pred_jsi.id,
      HINT = 'Ensure earlier stages finish before scheduling later stages.';
  END IF;

  RETURN NEW;
END;
$function$;