-- Phase 1: Fix PROOF Stage Timing from 480 minutes to 15 minutes
UPDATE public.production_stages 
SET 
  make_ready_time_minutes = 15,
  running_speed_per_hour = 240,  -- 4 per minute = 240 per hour for 15 min average
  updated_at = now()
WHERE name ILIKE '%proof%';

-- Update existing job stage instances in PROOF to reflect correct timing
UPDATE public.job_stage_instances 
SET 
  estimated_duration_minutes = 15,
  setup_time_minutes = 15,
  updated_at = now()
WHERE production_stage_id IN (
  SELECT id FROM public.production_stages WHERE name ILIKE '%proof%'
) AND status IN ('pending', 'active');

-- Create function to bulk recalculate job due dates with workload awareness
CREATE OR REPLACE FUNCTION public.bulk_recalculate_job_due_dates()
RETURNS TABLE(updated_job_id uuid, old_due_date date, new_due_date date, estimated_hours numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  job_record RECORD;
  total_hours numeric := 0;
  new_due_date date;
  current_workload_days integer := 0;
BEGIN
  -- Get current workload in days
  SELECT COALESCE(SUM(total_estimated_hours), 0) / 8 INTO current_workload_days
  FROM public.daily_workload 
  WHERE date >= CURRENT_DATE;
  
  -- Process each production job that needs rescheduling
  FOR job_record IN
    SELECT 
      pj.id,
      pj.due_date as old_due_date,
      COALESCE(SUM(jsi.estimated_duration_minutes), 0) / 60.0 as total_estimated_hours
    FROM public.production_jobs pj
    LEFT JOIN public.job_stage_instances jsi ON (
      jsi.job_id = pj.id 
      AND jsi.job_table_name = 'production_jobs'
      AND jsi.status IN ('pending', 'active')
    )
    WHERE pj.status NOT IN ('completed', 'cancelled')
    GROUP BY pj.id, pj.due_date
    ORDER BY pj.created_at ASC
  LOOP
    -- Calculate working days needed (including current workload)
    total_hours := total_hours + job_record.total_estimated_hours;
    
    -- Add 1 day buffer as requested
    new_due_date := (CURRENT_DATE + INTERVAL '1 day' * (CEIL(total_hours / 8) + 1))::date;
    
    -- Update the job with new due date
    UPDATE public.production_jobs
    SET 
      due_date = new_due_date,
      updated_at = now()
    WHERE id = job_record.id;
    
    -- Return the update info
    RETURN QUERY SELECT 
      job_record.id,
      job_record.old_due_date,
      new_due_date,
      job_record.total_estimated_hours;
  END LOOP;
END;
$function$;