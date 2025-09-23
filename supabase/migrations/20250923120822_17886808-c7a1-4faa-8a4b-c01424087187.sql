-- Drop and recreate the clear function with enhanced overdue handling (fixed variable naming)
DROP FUNCTION IF EXISTS public.clear_non_completed_scheduling_data();

CREATE OR REPLACE FUNCTION public.clear_non_completed_scheduling_data()
RETURNS TABLE(cleared_slots integer, cleared_instances integer, reset_overdue_stages integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cleared_slots_count integer := 0;
  cleared_instances_count integer := 0;
  reset_overdue_count integer := 0;
  current_utc_time timestamptz;
BEGIN
  -- Get current factory time for overdue detection
  current_utc_time := now();
  
  RAISE NOTICE 'SCHEDULER CLEANUP: Starting cleanup at %', current_utc_time;
  
  -- STEP 1: Reset overdue active stages to pending
  -- These are stages that should have completed but are still marked as active
  UPDATE job_stage_instances
  SET 
    status = 'pending',
    started_at = NULL,
    started_by = NULL,
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    schedule_status = 'unscheduled',
    updated_at = current_utc_time
  WHERE status = 'active'
    AND scheduled_end_at IS NOT NULL
    AND scheduled_end_at < current_utc_time - interval '1 hour'; -- Give 1 hour grace period
  
  GET DIAGNOSTICS reset_overdue_count = ROW_COUNT;
  RAISE NOTICE 'SCHEDULER CLEANUP: Reset % overdue active stages to pending', reset_overdue_count;
  
  -- STEP 2: Clear scheduling data for all non-completed stages
  UPDATE job_stage_instances
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = 'unscheduled',
    updated_at = current_utc_time
  WHERE COALESCE(status, '') NOT IN ('completed');
  
  GET DIAGNOSTICS cleared_instances_count = ROW_COUNT;
  RAISE NOTICE 'SCHEDULER CLEANUP: Cleared scheduling data from % job stage instances', cleared_instances_count;
  
  -- STEP 3: Delete all non-completed time slots
  DELETE FROM stage_time_slots 
  WHERE COALESCE(is_completed, false) = false;
  
  GET DIAGNOSTICS cleared_slots_count = ROW_COUNT;
  RAISE NOTICE 'SCHEDULER CLEANUP: Deleted % non-completed time slots', cleared_slots_count;
  
  -- Return summary
  cleared_slots := cleared_slots_count;
  cleared_instances := cleared_instances_count;
  reset_overdue_stages := reset_overdue_count;
  RETURN NEXT;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'SCHEDULER CLEANUP failed: %', SQLERRM;
END;
$function$;