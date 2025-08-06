-- Add 'manual_full' and 'capacity_extension' to the allowed calculation types
ALTER TABLE public.schedule_calculation_log 
DROP CONSTRAINT schedule_calculation_log_calculation_type_check;

ALTER TABLE public.schedule_calculation_log 
ADD CONSTRAINT schedule_calculation_log_calculation_type_check 
CHECK (calculation_type = ANY (ARRAY[
  'nightly_full'::text, 
  'job_update'::text, 
  'capacity_change'::text, 
  'manual_reschedule'::text, 
  'initial_population'::text, 
  'due_date_calculation'::text, 
  'proof_completion'::text,
  'manual_full'::text,
  'capacity_extension'::text
]));