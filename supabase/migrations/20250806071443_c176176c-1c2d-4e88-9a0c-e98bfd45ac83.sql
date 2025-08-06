-- Fix the check constraint to allow all the calculation types we use
ALTER TABLE public.schedule_calculation_log 
DROP CONSTRAINT IF EXISTS schedule_calculation_log_calculation_type_check;

ALTER TABLE public.schedule_calculation_log 
ADD CONSTRAINT schedule_calculation_log_calculation_type_check 
CHECK (calculation_type IN ('nightly_full', 'job_update', 'capacity_change', 'manual_reschedule', 'initial_population'));

-- Now test the function
SELECT public.populate_initial_schedules() as result;