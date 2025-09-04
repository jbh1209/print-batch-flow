-- Fix create_stage_availability_tracker to support both persistent queues AND legacy _stage_tails table
CREATE OR REPLACE FUNCTION public.create_stage_availability_tracker()
RETURNS VOID
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Initialize persistent queue state for new scheduler
  PERFORM public.initialize_queue_state();
  
  -- ALSO create temporary _stage_tails table for backward compatibility with legacy schedulers
  CREATE TEMPORARY TABLE IF NOT EXISTS _stage_tails(
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
  
  -- Initialize _stage_tails with current availability data from persistent queues
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT 
    psq.production_stage_id,
    COALESCE(psq.next_available_time, now()) as next_available_time
  FROM production_stage_queues psq
  ON CONFLICT (stage_id) DO UPDATE SET
    next_available_time = EXCLUDED.next_available_time;
  
  -- Ensure all production stages are represented in _stage_tails
  INSERT INTO _stage_tails(stage_id, next_available_time)
  SELECT DISTINCT 
    ps.id,
    now() as next_available_time
  FROM production_stages ps
  WHERE ps.id NOT IN (SELECT stage_id FROM _stage_tails)
  ON CONFLICT (stage_id) DO NOTHING;
  
END;
$function$;