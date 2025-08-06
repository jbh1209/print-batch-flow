-- Drop and recreate the constraint properly
ALTER TABLE public.schedule_calculation_log 
DROP CONSTRAINT schedule_calculation_log_calculation_type_check;

ALTER TABLE public.schedule_calculation_log 
ADD CONSTRAINT schedule_calculation_log_calculation_type_check 
CHECK (calculation_type = ANY (ARRAY['nightly_full'::text, 'job_update'::text, 'capacity_change'::text, 'manual_reschedule'::text, 'initial_population'::text]));