-- 1) Create a lightweight scheduling queue and triggers for reactive scheduling

-- Table: schedule_job_queue
CREATE TABLE IF NOT EXISTS public.schedule_job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  job_table_name text NOT NULL DEFAULT 'production_jobs',
  trigger_reason text NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  locked_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);

-- Enable RLS and allow system access
ALTER TABLE public.schedule_job_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'schedule_job_queue' AND policyname = 'Allow system to manage schedule queue'
  ) THEN
    CREATE POLICY "Allow system to manage schedule queue"
    ON public.schedule_job_queue
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Ensure only one unprocessed queue row per job
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uniq_unprocessed_job'
  ) THEN
    CREATE UNIQUE INDEX uniq_unprocessed_job
    ON public.schedule_job_queue (job_id)
    WHERE processed = false;
  END IF;
END $$;

-- Trigger function: enqueue when a production job transitions to 'In Production'
CREATE OR REPLACE FUNCTION public.enqueue_schedule_on_job_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'In Production' THEN
    INSERT INTO public.schedule_job_queue (job_id, job_table_name, trigger_reason)
    VALUES (NEW.id, TG_TABLE_NAME::text, 'job_status_in_production')
    ON CONFLICT ON CONSTRAINT uniq_unprocessed_job DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to production_jobs
DROP TRIGGER IF EXISTS trg_enqueue_schedule_on_job_status ON public.production_jobs;
CREATE TRIGGER trg_enqueue_schedule_on_job_status
AFTER UPDATE ON public.production_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_schedule_on_job_status();

-- Trigger function: enqueue when stage metrics change (status, estimated minutes, order)
CREATE OR REPLACE FUNCTION public.enqueue_schedule_on_stage_update()
RETURNS trigger AS $$
BEGIN
  -- Only consider production jobs table to avoid other tables in the system
  IF NEW.job_table_name = 'production_jobs' THEN
    IF (
      NEW.status IS DISTINCT FROM OLD.status OR
      NEW.estimated_duration_minutes IS DISTINCT FROM OLD.estimated_duration_minutes OR
      NEW.job_order_in_stage IS DISTINCT FROM OLD.job_order_in_stage
    ) THEN
      INSERT INTO public.schedule_job_queue (job_id, job_table_name, trigger_reason)
      VALUES (NEW.job_id, NEW.job_table_name, 'stage_update')
      ON CONFLICT ON CONSTRAINT uniq_unprocessed_job DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to job_stage_instances
DROP TRIGGER IF EXISTS trg_enqueue_schedule_on_stage_update ON public.job_stage_instances;
CREATE TRIGGER trg_enqueue_schedule_on_stage_update
AFTER UPDATE ON public.job_stage_instances
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_schedule_on_stage_update();
