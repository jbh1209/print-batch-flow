-- Create a function to reliably clear all scheduling data
CREATE OR REPLACE FUNCTION public.clear_all_stage_time_slots()
RETURNS TABLE(deleted_slots_count integer, deleted_instances_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  slots_count integer;
  instances_count integer;
BEGIN
  -- Count existing records before deletion
  SELECT COUNT(*) INTO slots_count FROM public.stage_time_slots;
  SELECT COUNT(*) INTO instances_count FROM public.job_stage_instances WHERE schedule_status = 'scheduled';
  
  -- Clear all stage time slots
  DELETE FROM public.stage_time_slots;
  
  -- Reset schedule status on job stage instances
  UPDATE public.job_stage_instances 
  SET 
    schedule_status = 'unscheduled',
    auto_scheduled_start_at = NULL,
    auto_scheduled_end_at = NULL,
    auto_scheduled_duration_minutes = NULL,
    updated_at = now()
  WHERE schedule_status = 'scheduled';
  
  -- Return counts of deleted records
  RETURN QUERY SELECT slots_count, instances_count;
END;
$$;