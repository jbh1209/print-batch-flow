-- Fix critical scheduler system issues
-- 1. Clear corrupted scheduling data from the reported error job
-- 2. Ensure all stage dependencies are properly reset

-- Clear scheduling data for the problematic job to prevent cascading errors
UPDATE job_stage_instances 
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = NULL,
  schedule_status = 'unscheduled',
  updated_at = now()
WHERE job_id = '8df6da79-e6e3-466e-96aa-bae186870c18' 
  AND COALESCE(status, '') NOT IN ('completed', 'active');

-- Clear related time slots for this job
DELETE FROM stage_time_slots 
WHERE job_id = '8df6da79-e6e3-466e-96aa-bae186870c18'
  AND COALESCE(is_completed, false) = false;

-- Create a comprehensive data cleanup function
CREATE OR REPLACE FUNCTION public.clear_non_completed_scheduling_data()
RETURNS TABLE(cleared_slots integer, cleared_instances integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  slots_count integer := 0;
  instances_count integer := 0;
BEGIN
  -- Clear non-completed time slots
  DELETE FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = false;
  GET DIAGNOSTICS slots_count = ROW_COUNT;
  
  -- Clear scheduling data from non-completed job stage instances
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = 'unscheduled',
    updated_at = now()
  WHERE COALESCE(status, '') NOT IN ('completed', 'active')
    AND (scheduled_start_at IS NOT NULL OR scheduled_end_at IS NOT NULL);
  GET DIAGNOSTICS instances_count = ROW_COUNT;
  
  RETURN QUERY SELECT slots_count, instances_count;
END;
$$;

-- Create temporary stage availability tracker
CREATE OR REPLACE FUNCTION public.create_stage_availability_tracker()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create temporary table for tracking stage availability during scheduling
  DROP TABLE IF EXISTS _stage_tails;
  CREATE TEMP TABLE _stage_tails (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
END;
$$;