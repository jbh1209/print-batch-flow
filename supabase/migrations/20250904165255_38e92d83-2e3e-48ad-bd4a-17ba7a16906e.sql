-- Fix initialize_queue_state function to use TRUNCATE instead of DELETE without WHERE clause
CREATE OR REPLACE FUNCTION public.initialize_queue_state()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  queue_count INTEGER := 0;
BEGIN
  -- Clear existing queue state using TRUNCATE (safer than DELETE without WHERE)
  TRUNCATE stage_queue_positions;
  TRUNCATE production_stage_queues;
  
  -- Initialize queues for all production stages with current availability
  INSERT INTO production_stage_queues (production_stage_id, next_available_time, total_scheduled_minutes, active_jobs_count)
  SELECT 
    ps.id,
    GREATEST(
      COALESCE(MAX(sts.slot_end_time), now()),
      now()
    ) as next_available_time,
    COALESCE(SUM(
      CASE 
        WHEN sts.is_completed = false THEN sts.duration_minutes 
        ELSE 0 
      END
    ), 0) as total_scheduled_minutes,
    COUNT(DISTINCT CASE WHEN sts.is_completed = false THEN sts.job_id END) as active_jobs_count
  FROM production_stages ps
  LEFT JOIN stage_time_slots sts ON sts.production_stage_id = ps.id
  GROUP BY ps.id
  ON CONFLICT (production_stage_id) DO UPDATE SET
    next_available_time = EXCLUDED.next_available_time,
    total_scheduled_minutes = EXCLUDED.total_scheduled_minutes,
    active_jobs_count = EXCLUDED.active_jobs_count,
    last_updated = now();
  
  GET DIAGNOSTICS queue_count = ROW_COUNT;
  
  -- Initialize queue positions for scheduled but not completed stages
  INSERT INTO stage_queue_positions (
    production_stage_id, stage_instance_id, job_id, job_table_name,
    queue_position, estimated_start_time, estimated_end_time, 
    duration_minutes, status
  )
  SELECT 
    jsi.production_stage_id,
    jsi.id,
    jsi.job_id,
    jsi.job_table_name,
    ROW_NUMBER() OVER (
      PARTITION BY jsi.production_stage_id 
      ORDER BY COALESCE(jsi.scheduled_start_at, jsi.created_at)
    ) as queue_position,
    jsi.scheduled_start_at,
    jsi.scheduled_end_at,
    COALESCE(jsi.scheduled_minutes, jsi.estimated_duration_minutes, 60),
    CASE 
      WHEN jsi.status = 'completed' THEN 'completed'
      WHEN jsi.status = 'active' THEN 'active'
      WHEN jsi.scheduled_start_at IS NOT NULL THEN 'queued'
      ELSE 'queued'
    END as status
  FROM job_stage_instances jsi
  WHERE jsi.status IN ('pending', 'scheduled', 'active', 'completed')
  ON CONFLICT (stage_instance_id) DO UPDATE SET
    queue_position = EXCLUDED.queue_position,
    estimated_start_time = EXCLUDED.estimated_start_time,
    estimated_end_time = EXCLUDED.estimated_end_time,
    status = EXCLUDED.status,
    updated_at = now();
  
  RETURN queue_count;
END;
$function$;