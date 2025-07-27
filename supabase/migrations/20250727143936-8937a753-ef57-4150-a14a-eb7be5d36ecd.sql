-- Update all job_stage_instances with null estimated_duration_minutes
-- Use production stage timing data and quantity to calculate realistic estimates

UPDATE job_stage_instances 
SET estimated_duration_minutes = (
  SELECT 
    CASE 
      WHEN ps.running_speed_per_hour IS NULL OR ps.running_speed_per_hour = 0 THEN 480 -- Default 8 hours
      WHEN job_stage_instances.quantity IS NULL OR job_stage_instances.quantity = 0 THEN COALESCE(ps.make_ready_time_minutes, 10) -- Just setup time
      ELSE (
        CASE ps.speed_unit
          WHEN 'sheets_per_hour' THEN 
            CEIL((job_stage_instances.quantity::NUMERIC / ps.running_speed_per_hour::NUMERIC) * 60) + COALESCE(ps.make_ready_time_minutes, 10)
          WHEN 'minutes_per_item' THEN 
            (job_stage_instances.quantity * ps.running_speed_per_hour) + COALESCE(ps.make_ready_time_minutes, 10)
          ELSE 
            CEIL((job_stage_instances.quantity::NUMERIC / ps.running_speed_per_hour::NUMERIC) * 60) + COALESCE(ps.make_ready_time_minutes, 10)
        END
      )
    END
  FROM production_stages ps
  WHERE ps.id = job_stage_instances.production_stage_id
)
WHERE estimated_duration_minutes IS NULL 
  AND status IN ('pending', 'active');