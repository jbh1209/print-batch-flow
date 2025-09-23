-- Create stage specification for Box Gluing with reasonable defaults
INSERT INTO stage_specifications (
  name,
  description,
  production_stage_id,
  running_speed_per_hour,
  speed_unit,
  make_ready_time_minutes,
  is_active
) 
SELECT 
  'Box Gluing',
  'Automated box gluing process',
  ps.id,
  1200,  -- 1200 items per hour (faster than make up boxes at 250/hr)
  'items_per_hour',
  15,    -- 15 minute setup time
  true
FROM production_stages ps 
WHERE ps.name = 'Box Gluing'
ON CONFLICT (name, production_stage_id) DO UPDATE SET
  running_speed_per_hour = EXCLUDED.running_speed_per_hour,
  make_ready_time_minutes = EXCLUDED.make_ready_time_minutes,
  updated_at = now();