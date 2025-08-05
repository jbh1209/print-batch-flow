-- Create the missing calculate_stage_queue_workload RPC function
CREATE OR REPLACE FUNCTION calculate_stage_queue_workload(stage_id UUID DEFAULT NULL)
RETURNS TABLE (
  production_stage_id UUID,
  stage_name TEXT,
  pending_hours NUMERIC,
  active_hours NUMERIC,
  pending_jobs_count INTEGER,
  active_jobs_count INTEGER,
  daily_capacity_hours INTEGER,
  queue_processing_days NUMERIC,
  utilization_percentage NUMERIC,
  is_bottleneck BOOLEAN
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH stage_workload AS (
    SELECT 
      ps.id as production_stage_id,
      ps.name as stage_name,
      scp.daily_capacity_hours,
      scp.efficiency_factor,
      scp.is_bottleneck,
      -- Calculate pending hours
      COALESCE(SUM(
        CASE WHEN jsi.status = 'pending' 
        THEN COALESCE(jsi.estimated_duration_minutes, 60) / 60.0 
        ELSE 0 END
      ), 0) as pending_hours,
      -- Calculate active hours  
      COALESCE(SUM(
        CASE WHEN jsi.status = 'active' 
        THEN COALESCE(jsi.estimated_duration_minutes, 60) / 60.0 
        ELSE 0 END
      ), 0) as active_hours,
      -- Count pending jobs
      COUNT(CASE WHEN jsi.status = 'pending' THEN 1 END) as pending_jobs_count,
      -- Count active jobs
      COUNT(CASE WHEN jsi.status = 'active' THEN 1 END) as active_jobs_count
    FROM production_stages ps
    LEFT JOIN stage_capacity_profiles scp ON ps.id = scp.production_stage_id
    LEFT JOIN job_stage_instances jsi ON ps.id = jsi.production_stage_id
    WHERE (stage_id IS NULL OR ps.id = stage_id)
    GROUP BY ps.id, ps.name, scp.daily_capacity_hours, scp.efficiency_factor, scp.is_bottleneck
  )
  SELECT 
    sw.production_stage_id,
    sw.stage_name,
    sw.pending_hours,
    sw.active_hours,
    sw.pending_jobs_count,
    sw.active_jobs_count,
    COALESCE(sw.daily_capacity_hours, 8) as daily_capacity_hours,
    -- Calculate queue processing days
    CASE 
      WHEN COALESCE(sw.daily_capacity_hours, 8) > 0 
      THEN (sw.pending_hours + sw.active_hours) / COALESCE(sw.daily_capacity_hours, 8)
      ELSE 0
    END as queue_processing_days,
    -- Calculate utilization percentage
    CASE 
      WHEN COALESCE(sw.daily_capacity_hours, 8) > 0 
      THEN ((sw.pending_hours + sw.active_hours) / COALESCE(sw.daily_capacity_hours, 8)) * 100
      ELSE 0
    END as utilization_percentage,
    COALESCE(sw.is_bottleneck, false) as is_bottleneck
  FROM stage_workload sw
  ORDER BY sw.production_stage_id;
END;
$$;

-- Ensure stage_capacity_profiles has default data for all production stages
INSERT INTO stage_capacity_profiles (
  production_stage_id, 
  daily_capacity_hours, 
  max_parallel_jobs, 
  setup_time_minutes, 
  is_bottleneck, 
  working_days_per_week, 
  shift_hours_per_day, 
  efficiency_factor
)
SELECT 
  ps.id,
  8 as daily_capacity_hours,
  1 as max_parallel_jobs,
  0 as setup_time_minutes,
  false as is_bottleneck,
  5 as working_days_per_week,
  8 as shift_hours_per_day,
  0.85 as efficiency_factor
FROM production_stages ps
WHERE NOT EXISTS (
  SELECT 1 FROM stage_capacity_profiles scp 
  WHERE scp.production_stage_id = ps.id
)
ON CONFLICT (production_stage_id) DO NOTHING;