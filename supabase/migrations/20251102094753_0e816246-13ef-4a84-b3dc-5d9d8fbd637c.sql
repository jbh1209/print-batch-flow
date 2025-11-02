-- Bulk complete all DTP stages - CORRECTED VERSION
-- Uses production_stage_id instead of stage instance id

DO $$
DECLARE
  v_rec record;
  v_result boolean;
  v_error_msg text;
  v_completed_count int := 0;
  v_failed_count int := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🚀 STARTING BULK DTP COMPLETION (FIXED)';
  RAISE NOTICE '========================================';
  
  -- STEP 1: Process jobs with ACTIVE DTP stages
  RAISE NOTICE '';
  RAISE NOTICE '📋 STEP 1: Processing jobs with ACTIVE DTP stages...';
  
  FOR v_rec IN (
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.job_table_name,
      jsi.production_stage_id,  -- THIS IS WHAT THE FUNCTION NEEDS
      pj.wo_no,
      ps.name as stage_name
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    JOIN production_stages ps ON jsi.production_stage_id = ps.id
    WHERE ps.name ILIKE '%DTP%'
      AND jsi.status = 'active'
      AND jsi.job_table_name = 'production_jobs'
    ORDER BY jsi.created_at
  )
  LOOP
    BEGIN
      RAISE NOTICE '  ⚙️  Processing active DTP job: % (production_stage_id: %)', v_rec.wo_no, v_rec.production_stage_id;
      
      -- Call with PRODUCTION_STAGE_ID, not stage instance id
      SELECT public.advance_job_stage_with_parallel_support(
        v_rec.job_id,
        v_rec.job_table_name,
        v_rec.production_stage_id,  -- CORRECTED: Use production_stage_id
        'Bulk DTP completion - automated advancement'
      ) INTO v_result;
      
      v_completed_count := v_completed_count + 1;
      
      RAISE NOTICE '  ✅ SUCCESS: Job % advanced to next stage', v_rec.wo_no;
      
      INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        v_rec.job_id,
        v_rec.wo_no,
        'bulk_dtp_completion_FIXED_SUCCESS',
        format('Advanced from active DTP stage. Stage instance: %s', v_rec.stage_instance_id)
      );
      
    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      v_failed_count := v_failed_count + 1;
      
      RAISE WARNING '  ❌ FAILED: Job % - %', v_rec.wo_no, v_error_msg;
      
      INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        v_rec.job_id,
        v_rec.wo_no,
        'bulk_dtp_completion_FIXED_ERROR',
        format('FAILED to advance from active DTP: %s', v_error_msg)
      );
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 Step 1 Results: %s completed, %s failed', v_completed_count, v_failed_count;
  
  -- STEP 2: Process jobs where DTP is the NEXT PENDING stage
  RAISE NOTICE '';
  RAISE NOTICE '📋 STEP 2: Processing jobs where DTP is next pending stage...';
  
  v_completed_count := 0;
  v_failed_count := 0;
  
  FOR v_rec IN (
    SELECT DISTINCT ON (jsi.job_id)
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.job_table_name,
      jsi.production_stage_id,  -- THIS IS WHAT THE FUNCTION NEEDS
      pj.wo_no,
      ps.name as stage_name,
      jsi.stage_order
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    JOIN production_stages ps ON jsi.production_stage_id = ps.id
    WHERE ps.name ILIKE '%DTP%'
      AND jsi.status = 'pending'
      AND jsi.job_table_name = 'production_jobs'
      -- Only jobs with NO active stage
      AND NOT EXISTS (
        SELECT 1 FROM job_stage_instances jsi2
        WHERE jsi2.job_id = jsi.job_id
          AND jsi2.job_table_name = jsi.job_table_name
          AND jsi2.status = 'active'
      )
    ORDER BY jsi.job_id, jsi.stage_order
  )
  LOOP
    BEGIN
      RAISE NOTICE '  ⚙️  Processing pending DTP job: % (production_stage_id: %)', v_rec.wo_no, v_rec.production_stage_id;
      
      -- First, activate the DTP stage
      UPDATE job_stage_instances
      SET 
        status = 'active',
        started_at = NOW(),
        updated_at = NOW()
      WHERE id = v_rec.stage_instance_id;
      
      RAISE NOTICE '  ✓ Activated DTP stage for job %', v_rec.wo_no;
      
      -- Now advance it using production_stage_id
      SELECT public.advance_job_stage_with_parallel_support(
        v_rec.job_id,
        v_rec.job_table_name,
        v_rec.production_stage_id,  -- CORRECTED: Use production_stage_id
        'Bulk DTP completion - activated then advanced'
      ) INTO v_result;
      
      v_completed_count := v_completed_count + 1;
      
      RAISE NOTICE '  ✅ SUCCESS: Job % activated and advanced to next stage', v_rec.wo_no;
      
      INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        v_rec.job_id,
        v_rec.wo_no,
        'bulk_dtp_completion_FIXED_SUCCESS',
        format('Activated pending DTP then advanced. Stage instance: %s', v_rec.stage_instance_id)
      );
      
    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      v_failed_count := v_failed_count + 1;
      
      RAISE WARNING '  ❌ FAILED: Job % - %', v_rec.wo_no, v_error_msg;
      
      INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        v_rec.job_id,
        v_rec.wo_no,
        'bulk_dtp_completion_FIXED_ERROR',
        format('FAILED to activate/advance pending DTP: %s', v_error_msg)
      );
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 Step 2 Results: %s completed, %s failed', v_completed_count, v_failed_count;
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ BULK DTP COMPLETION PROCESS FINISHED';
  RAISE NOTICE '========================================';
  
END $$;

-- Verification: Check remaining DTP stages after completion
SELECT 
  ps.name as stage_name,
  jsi.status,
  COUNT(*) as count
FROM job_stage_instances jsi
JOIN production_stages ps ON jsi.production_stage_id = ps.id
WHERE ps.name ILIKE '%DTP%'
  AND jsi.job_table_name = 'production_jobs'
GROUP BY ps.name, jsi.status
ORDER BY ps.name, jsi.status;