-- Fix the populate_initial_schedules function to use proper type casting
CREATE OR REPLACE FUNCTION public.populate_initial_schedules()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE 'Starting initial population of schedules';
  
  -- Run the schedule calculation for the next 2 weeks
  SELECT public.calculate_daily_schedules(
    CURRENT_DATE::date,
    (CURRENT_DATE + INTERVAL '14 days')::date,
    'initial_population'::text
  ) INTO result;
  
  RAISE NOTICE 'Initial population completed: %', result;
  
  RETURN result;
END;
$function$;