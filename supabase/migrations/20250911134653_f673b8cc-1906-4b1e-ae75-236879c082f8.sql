-- EMERGENCY SCHEDULER STANDARDIZATION - PHASE 3 & 4
-- Phase 3: Update Cron Job and Complete Standardization

-- First, remove existing cron job if it exists
SELECT cron.unschedule('nightly-reschedule') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'nightly-reschedule'
);

-- Create improved 3 AM daily reschedule cron job
SELECT cron.schedule(
  'nightly-reschedule',
  '0 3 * * *', -- 3 AM every day
  $$
  BEGIN
    -- Log start
    INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'CRON', 'nightly_reschedule_start', 
            'Starting 3 AM reschedule using scheduler_resource_fill_optimized');
    
    -- Run the standardized scheduler
    PERFORM scheduler_resource_fill_optimized();
    
    -- Log completion
    INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'CRON', 'nightly_reschedule_complete', 
            'Completed 3 AM reschedule successfully');
            
  EXCEPTION WHEN OTHERS THEN
    -- Log error
    INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'CRON', 'nightly_reschedule_error', 
            'Error in 3 AM reschedule: ' || SQLERRM);
    RAISE;
  END;
  $$
);

-- Phase 4: Mark deprecated functions and run immediate catch-up
COMMENT ON FUNCTION scheduler_reschedule_all_parallel_aware() IS 'DEPRECATED: Use scheduler_resource_fill_optimized instead';

-- Run immediate catch-up scheduling for the backfilled jobs
DO $$
BEGIN
  RAISE NOTICE 'Running immediate catch-up scheduling for newly approved jobs...';
  PERFORM scheduler_resource_fill_optimized();
  
  INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
  VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'MIGRATION', 'emergency_scheduler_complete', 
          'Emergency scheduler standardization completed - all jobs should now be using scheduler_resource_fill_optimized');
END $$;