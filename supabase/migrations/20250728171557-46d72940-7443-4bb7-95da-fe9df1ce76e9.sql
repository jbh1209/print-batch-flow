-- Enhanced calculate_stage_queue_workload function to support batch operations
CREATE OR REPLACE FUNCTION public.calculate_stage_queue_workload(stage_ids UUID[])
RETURNS TABLE(
  stage_id UUID,
  total_pending_hours DECIMAL(8,2),
  total_active_hours DECIMAL(8,2),
  pending_jobs_count INTEGER,
  active_jobs_count INTEGER,
  earliest_available_slot TIMESTAMP WITH TIME ZONE,
  queue_processing_hours DECIMAL(8,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_record RECORD;
  stage_capacity RECORD;
  daily_hours DECIMAL(8,2);
BEGIN
  FOR stage_record IN 
    SELECT UNNEST(stage_ids) as sid
  LOOP
    -- Get stage capacity info
    SELECT daily_capacity_hours, efficiency_factor
    INTO stage_capacity
    FROM public.stage_capacity_profiles
    WHERE production_stage_id = stage_record.sid;
    
    IF NOT FOUND THEN
      -- Default capacity if not configured
      daily_hours := 8.0;
    ELSE
      daily_hours := stage_capacity.daily_capacity_hours * stage_capacity.efficiency_factor;
    END IF;
    
    -- Calculate workload for this stage
    RETURN QUERY
    SELECT 
      stage_record.sid as stage_id,
      COALESCE(SUM(CASE WHEN jsi.status = 'pending' THEN jsi.estimated_duration_minutes END), 0) / 60.0 as total_pending_hours,
      COALESCE(SUM(CASE WHEN jsi.status = 'active' THEN jsi.estimated_duration_minutes END), 0) / 60.0 as total_active_hours,
      COUNT(CASE WHEN jsi.status = 'pending' THEN 1 END)::INTEGER as pending_jobs_count,
      COUNT(CASE WHEN jsi.status = 'active' THEN 1 END)::INTEGER as active_jobs_count,
      (now() + INTERVAL '1 hour' * (COALESCE(SUM(jsi.estimated_duration_minutes), 0) / 60.0 / daily_hours)) as earliest_available_slot,
      (COALESCE(SUM(jsi.estimated_duration_minutes), 0) / 60.0) as queue_processing_hours
    FROM public.job_stage_instances jsi
    WHERE jsi.production_stage_id = stage_record.sid
      AND jsi.status IN ('pending', 'active');
  END LOOP;
END;
$$;