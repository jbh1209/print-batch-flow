-- Phase A: Seed scheduler version feature flag (1=legacy, 2=v2)
INSERT INTO public.app_settings (setting_type, product_type, sla_target_days)
SELECT 'scheduler_version', 'global', 2
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings 
  WHERE setting_type = 'scheduler_version' AND product_type = 'global'
);

-- Phase D: Guardrail constraints (add if not already present)
DO $$ BEGIN
  ALTER TABLE public.daily_stage_capacity 
    ADD CONSTRAINT dsc_scheduled_minutes_nonneg CHECK (scheduled_minutes >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.stage_workload_tracking 
    ADD CONSTRAINT swt_committed_hours_nonneg CHECK (committed_hours >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.stage_workload_tracking 
    ADD CONSTRAINT swt_available_hours_range CHECK (available_hours >= 0 AND available_hours <= 24);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.job_stage_instances 
    ADD CONSTRAINT jsi_scheduled_minutes_nonneg CHECK (scheduled_minutes >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;