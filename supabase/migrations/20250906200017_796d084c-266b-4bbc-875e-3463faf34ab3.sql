-- Fix the jsi_minutes function to treat 0 as NULL
-- This ensures that when scheduled_minutes = 0, it falls back to estimated_duration_minutes
CREATE OR REPLACE FUNCTION public.jsi_minutes(p_scheduled integer, p_estimated integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT greatest(
           1,
           COALESCE(NULLIF(p_scheduled, 0), p_estimated, 1)
         );
$function$;