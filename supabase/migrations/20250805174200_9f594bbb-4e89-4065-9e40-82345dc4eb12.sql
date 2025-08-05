-- Drop the existing function first to avoid type conflicts
DROP FUNCTION IF EXISTS calculate_stage_queue_workload(UUID);

-- Create the correct calculate_stage_queue_workload RPC function
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