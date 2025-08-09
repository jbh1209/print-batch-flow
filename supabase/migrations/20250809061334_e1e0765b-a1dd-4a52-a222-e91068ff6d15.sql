
-- Fix broken trigger function that references a non-existent column on production_jobs
-- Root cause: UPDATE on production_jobs used "job_table_name", which doesn't exist on that table

CREATE OR REPLACE FUNCTION public.auto_set_proof_approved_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only react when a stage transitions from active -> completed
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    -- Is this a proof stage?
    IF EXISTS (
      SELECT 1
      FROM public.production_stages ps
      WHERE ps.id = NEW.production_stage_id
        AND ps.name ILIKE '%proof%'
    ) THEN
      
      -- Only update production_jobs when the stage belongs to the production_jobs workflow
      IF NEW.job_table_name = 'production_jobs' THEN
        UPDATE public.production_jobs
        SET
          proof_approved_at = now(),
          production_ready = true,
          last_queue_recalc_at = now(),
          updated_at = now()
        WHERE id = NEW.job_id;
      END IF;

      -- Log the proof completion event
      INSERT INTO public.schedule_calculation_log (
        calculation_type,
        trigger_reason,
        created_by,
        started_at
      ) VALUES (
        'proof_completion',
        format('Job %s proof stage completed - ready for production queue', NEW.job_id),
        NEW.completed_by,
        now()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
