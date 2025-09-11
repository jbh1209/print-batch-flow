-- Create carry-forward function for overdue active jobs (Post-Approval stages only)
CREATE OR REPLACE FUNCTION carry_forward_overdue_active_jobs()
RETURNS TABLE(carried_forward_count integer, job_details text[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  job_record RECORD;
  total_carried integer := 0;
  job_list text[] := '{}';
BEGIN
  RAISE NOTICE '🔄 Starting carry-forward of overdue active jobs...';
  
  -- Find and process overdue active jobs (excluding DTP and PROOF stages)
  FOR job_record IN
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.production_stage_id,
      jsi.scheduled_end_at,
      jsi.started_at,
      jsi.started_by,
      ps.name as stage_name,
      pj.wo_no,
      EXTRACT(EPOCH FROM (now() - jsi.scheduled_end_at)) / 3600 as hours_overdue
    FROM job_stage_instances jsi
    JOIN production_stages ps ON jsi.production_stage_id = ps.id
    JOIN production_jobs pj ON jsi.job_id = pj.id
    WHERE jsi.status = 'active'
      AND jsi.scheduled_end_at < NOW()
      AND jsi.job_table_name = 'production_jobs'
      AND ps.name NOT ILIKE '%dtp%'
      AND ps.name NOT ILIKE '%proof%'
    ORDER BY jsi.scheduled_end_at ASC -- Process most overdue first
  LOOP
    -- Reset the overdue active job to pending with priority
    UPDATE job_stage_instances
    SET 
      status = 'pending',
      started_at = NULL,
      started_by = NULL,
      job_order_in_stage = 0, -- Priority position
      notes = COALESCE(notes || E'\n', '') || 
              'CARRIED_FORWARD: Was active but overdue by ' || 
              ROUND(job_record.hours_overdue::numeric, 1) || ' hours on ' || 
              now()::date || ' at 3 AM reschedule',
      updated_at = now()
    WHERE id = job_record.stage_instance_id;
    
    -- Clear existing time slots for this stage
    DELETE FROM stage_time_slots 
    WHERE stage_instance_id = job_record.stage_instance_id;
    
    -- Log the carry-forward action
    INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
    VALUES (
      job_record.job_id,
      job_record.wo_no,
      'carry_forward_overdue',
      format('Stage %s was active but %s hours overdue (scheduled end: %s). Reset to pending with priority.',
             job_record.stage_name,
             ROUND(job_record.hours_overdue::numeric, 1),
             job_record.scheduled_end_at::text)
    );
    
    total_carried := total_carried + 1;
    job_list := job_list || (job_record.wo_no || ' (' || job_record.stage_name || ')');
    
    RAISE NOTICE 'Carried forward: % - % (% hours overdue)', 
      job_record.wo_no, job_record.stage_name, ROUND(job_record.hours_overdue::numeric, 1);
  END LOOP;
  
  RAISE NOTICE '✅ Carry-forward complete: % jobs processed', total_carried;
  
  RETURN QUERY SELECT total_carried, job_list;
END;
$function$;

-- Update the existing 3 AM cron job to include carry-forward
SELECT cron.unschedule('nightly-reschedule') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'nightly-reschedule'
);

-- Create enhanced 3 AM cron job with carry-forward
SELECT cron.schedule(
  'nightly-reschedule',
  '0 3 * * *', -- 3 AM every day
  $$
  DO $$
  DECLARE
    carry_result RECORD;
  BEGIN
    -- Log start
    INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'CRON', 'nightly_reschedule_start', 
            'Starting 3 AM reschedule with carry-forward and scheduler_resource_fill_optimized');
    
    -- Step 1: Carry forward overdue active jobs
    SELECT * INTO carry_result FROM carry_forward_overdue_active_jobs();
    
    -- Log carry-forward results
    IF carry_result.carried_forward_count > 0 THEN
      INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
      VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'CRON', 'carry_forward_complete', 
              format('Carried forward %s overdue jobs: %s', 
                     carry_result.carried_forward_count, 
                     array_to_string(carry_result.job_details, ', ')));
    ELSE
      INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
      VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'CRON', 'carry_forward_complete', 
              'No overdue active jobs found to carry forward');
    END IF;
    
    -- Step 2: Run the standardized scheduler
    PERFORM scheduler_resource_fill_optimized();
    
    -- Log completion
    INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'CRON', 'nightly_reschedule_complete', 
            'Completed 3 AM reschedule with carry-forward successfully');
            
  EXCEPTION WHEN OTHERS THEN
    -- Log error
    INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'CRON', 'nightly_reschedule_error', 
            'Error in 3 AM reschedule: ' || SQLERRM);
    RAISE;
  END $$;
  $$
);