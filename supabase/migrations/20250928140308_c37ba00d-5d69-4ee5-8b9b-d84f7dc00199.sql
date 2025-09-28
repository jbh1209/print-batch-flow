-- Step 1: Fix the type mismatch bug in simple_scheduler_wrapper
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_record RECORD;
  result_json jsonb;
BEGIN
  RAISE NOTICE 'Scheduler wrapper called with mode: %', p_mode;
  
  -- Route reschedule_all to the ORIGINAL SEQUENTIAL scheduler (Monday morning behavior)
  IF p_mode = 'reschedule_all' THEN
    RAISE NOTICE 'Using ORIGINAL SEQUENTIAL scheduler for reschedule_all (Monday morning behavior)';
    
    SELECT * INTO result_record 
    FROM public.scheduler_reschedule_all_sequential_fixed(NULL);
    
    -- FIXED: Use jsonb array instead of integer 0 to match violations type
    result_json := jsonb_build_object(
      'scheduled_count', COALESCE(result_record.updated_jsi, 0),
      'wrote_slots', COALESCE(result_record.wrote_slots, 0),
      'success', true,
      'mode', 'reschedule_all_sequential',
      'violations', COALESCE(result_record.violations, '[]'::jsonb)
    );
    
  ELSE
    -- For other modes, use the resource-fill scheduler
    RAISE NOTICE 'Using resource-fill scheduler for mode: %', p_mode;
    
    SELECT * INTO result_record 
    FROM public.scheduler_resource_fill_optimized();
    
    -- Normalize the response
    result_json := jsonb_build_object(
      'scheduled_count', COALESCE(result_record.scheduled_count, 0),
      'wrote_slots', COALESCE(result_record.wrote_slots, 0), 
      'success', COALESCE(result_record.success, false),
      'mode', p_mode
    );
  END IF;
  
  RAISE NOTICE 'Scheduler wrapper completed: %', result_json;
  RETURN result_json;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in scheduler wrapper: %', SQLERRM;
  RETURN jsonb_build_object(
    'scheduled_count', 0,
    'wrote_slots', 0,
    'success', false,
    'error', SQLERRM,
    'mode', p_mode
  );
END;
$$;

-- Step 2: Create function to reset overdue active stages
CREATE OR REPLACE FUNCTION public.reset_overdue_active_instances(p_cutoff timestamptz DEFAULT now())
RETURNS TABLE(reset_count integer, reset_jobs jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reset_instances_count integer := 0;
  reset_job_list jsonb := '[]'::jsonb;
  temp_job_info record;
BEGIN
  RAISE NOTICE 'Resetting overdue active instances with cutoff: %', p_cutoff;
  
  -- Collect job info before reset for logging
  FOR temp_job_info IN
    SELECT 
      jsi.job_id,
      pj.wo_no,
      ps.name as stage_name,
      jsi.scheduled_end_at
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON pj.id = jsi.job_id
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    WHERE jsi.status = 'active'
      AND jsi.completed_at IS NULL 
      AND jsi.scheduled_end_at < p_cutoff
      AND jsi.job_table_name = 'production_jobs'
  LOOP
    reset_job_list := reset_job_list || jsonb_build_object(
      'job_id', temp_job_info.job_id,
      'wo_no', temp_job_info.wo_no,
      'stage_name', temp_job_info.stage_name,
      'was_scheduled_end', temp_job_info.scheduled_end_at
    );
  END LOOP;
  
  -- Reset overdue active stages to pending and clear scheduling
  UPDATE job_stage_instances 
  SET 
    status = 'pending',
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = 'unscheduled',
    updated_at = now()
  WHERE status = 'active'
    AND completed_at IS NULL 
    AND scheduled_end_at < p_cutoff
    AND job_table_name = 'production_jobs';
  
  GET DIAGNOSTICS reset_instances_count = ROW_COUNT;
  
  RAISE NOTICE 'Reset % overdue active instances', reset_instances_count;
  
  RETURN QUERY SELECT reset_instances_count, reset_job_list;
END;
$$;