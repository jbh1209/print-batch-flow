-- Fix DELETE without WHERE clause issue in create_stage_availability_tracker function
CREATE OR REPLACE FUNCTION public.create_stage_availability_tracker()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Legacy function that only creates the temporary _stage_tails table
  -- This is ONLY used by legacy schedulers, not the persistent queue scheduler
  CREATE TEMPORARY TABLE IF NOT EXISTS _stage_tails(
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
  
  -- Clear existing data to avoid conflicts on repeated calls
  -- Use TRUNCATE instead of DELETE to avoid "DELETE requires WHERE clause" error
  TRUNCATE _stage_tails;
  
END;
$function$;