-- Fix simple_scheduler_wrapper to pass required p_start_from parameter
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_data jsonb;
  start_from_time timestamptz;
BEGIN
  -- Calculate next working start time
  SELECT public.next_working_start(now()) INTO start_from_time;
  
  CASE p_mode
    WHEN 'reschedule_all' THEN
      -- Call the September 24th protected sequential scheduler with proper parameter
      SELECT public.scheduler_reschedule_all_sequential_fixed(start_from_time) INTO result_data;
      
    WHEN 'append_only' THEN
      -- For append operations, also need start time
      SELECT public.scheduler_reschedule_all_sequential_fixed(start_from_time) INTO result_data;
      
    ELSE
      -- Default to reschedule_all with start time
      SELECT public.scheduler_reschedule_all_sequential_fixed(start_from_time) INTO result_data;
  END CASE;
  
  RETURN result_data;
END;
$$;