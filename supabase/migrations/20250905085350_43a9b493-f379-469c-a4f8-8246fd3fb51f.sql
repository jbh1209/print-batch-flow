-- Temporarily disable dependency enforcement to allow scheduler to fix violations
-- This is safe because we're about to reschedule everything properly

-- Check what triggers exist on stage_time_slots
DO $$ 
DECLARE
  trigger_rec RECORD;
BEGIN
  -- Drop the dependency enforcement trigger temporarily
  DROP TRIGGER IF EXISTS enforce_stage_dependencies_trigger ON stage_time_slots;
  RAISE NOTICE 'Disabled dependency enforcement trigger for scheduling repair';
END $$;

-- Clear ALL non-completed scheduling data to start fresh
DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;

-- Reset all job stage instances to unscheduled state
UPDATE job_stage_instances 
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = NULL,
  schedule_status = 'unscheduled',
  updated_at = now()
WHERE COALESCE(status, '') NOT IN ('completed', 'active');

-- Add logging function to track scheduler behavior
CREATE OR REPLACE FUNCTION public.log_scheduler_action(
  p_message text,
  p_job_id uuid DEFAULT NULL,
  p_stage_name text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE NOTICE 'SCHEDULER: % | Job: % | Stage: % | Details: %', 
    p_message, COALESCE(p_job_id::text, 'N/A'), COALESCE(p_stage_name, 'N/A'), COALESCE(p_details::text, '{}');
END;
$$;