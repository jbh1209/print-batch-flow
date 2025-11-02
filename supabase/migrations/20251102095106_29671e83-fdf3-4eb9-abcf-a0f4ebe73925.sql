-- Direct bulk DTP completion - bypass the buggy RPC function
-- This directly updates the database without using advance_job_stage_with_parallel_support

DO $$
DECLARE
  v_job_rec record;
  v_dtp_stage_id uuid;
  v_next_stage_id uuid;
  v_completed_count int := 0;
  v_failed_count int := 0;
  v_error_msg text;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🚀 DIRECT BULK DTP COMPLETION';
  RAISE NOTICE '========================================';
  
  -- Get the DTP production stage ID
  SELECT id INTO v_dtp_stage_id
  FROM production_stages
  WHERE name ILIKE '%DTP%'
  LIMIT 1;
  
  RAISE NOTICE 'DTP Stage ID: %', v_dtp_stage_id;
  
  -- Process each job with an active DTP stage
  FOR v_job_rec IN (
    SELECT 
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.job_table_name,
      pj.wo_no,
      jsi.stage_order
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    WHERE jsi.production_stage_id = v_dtp_stage_id
      AND jsi.status = 'active'
      AND jsi.job_table_name = 'production_jobs'
    ORDER BY jsi.created_at
  )
  LOOP
    BEGIN
      RAISE NOTICE '  Processing job: %', v_job_rec.wo_no;
      
      -- Step 1: Mark current DTP stage as completed
      UPDATE job_stage_instances
      SET 
        status = 'completed',
        completed_at = NOW(),
        actual_duration_minutes = CASE 
          WHEN started_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 
          ELSE NULL 
        END,
        notes = 'Bulk DTP completion - direct update',
        updated_at = NOW()
      WHERE id = v_job_rec.stage_instance_id;
      
      -- Step 2: Find and activate the next pending stage for this job
      SELECT id INTO v_next_stage_id
      FROM job_stage_instances
      WHERE job_id = v_job_rec.job_id
        AND job_table_name = v_job_rec.job_table_name
        AND status = 'pending'
        AND stage_order > v_job_rec.stage_order
      ORDER BY stage_order ASC
      LIMIT 1;
      
      IF v_next_stage_id IS NOT NULL THEN
        UPDATE job_stage_instances
        SET 
          status = 'active',
          started_at = NOW(),
          updated_at = NOW()
        WHERE id = v_next_stage_id;
        
        RAISE NOTICE '  ✅ Job % completed DTP and activated next stage', v_job_rec.wo_no;
      ELSE
        RAISE NOTICE '  ✅ Job % completed DTP (no more pending stages)', v_job_rec.wo_no;
      END IF;
      
      v_completed_count := v_completed_count + 1;
      
      -- Log success
      INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        v_job_rec.job_id,
        v_job_rec.wo_no,
        'bulk_dtp_direct_SUCCESS',
        format('DTP stage completed and next stage activated. Stage instance: %s', v_job_rec.stage_instance_id)
      );
      
    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      v_failed_count := v_failed_count + 1;
      
      RAISE WARNING '  ❌ FAILED: Job % - %', v_job_rec.wo_no, v_error_msg;
      
      INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        v_job_rec.job_id,
        v_job_rec.wo_no,
        'bulk_dtp_direct_ERROR',
        format('FAILED: %s', v_error_msg)
      );
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 Results: %s completed, %s failed', v_completed_count, v_failed_count;
  
  -- Now handle pending DTP jobs (where DTP is next but not yet active)
  RAISE NOTICE '';
  RAISE NOTICE '📋 Processing jobs where DTP is next pending stage...';
  
  v_completed_count := 0;
  v_failed_count := 0;
  
  FOR v_job_rec IN (
    SELECT DISTINCT ON (jsi.job_id)
      jsi.id as stage_instance_id,
      jsi.job_id,
      jsi.job_table_name,
      pj.wo_no,
      jsi.stage_order
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    WHERE jsi.production_stage_id = v_dtp_stage_id
      AND jsi.status = 'pending'
      AND jsi.job_table_name = 'production_jobs'
      -- Only if no active stage exists
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
      RAISE NOTICE '  Processing pending DTP job: %', v_job_rec.wo_no;
      
      -- Activate DTP, then immediately complete it
      UPDATE job_stage_instances
      SET 
        status = 'completed',
        started_at = NOW(),
        completed_at = NOW(),
        actual_duration_minutes = 0,
        notes = 'Bulk DTP completion - pending activated and completed',
        updated_at = NOW()
      WHERE id = v_job_rec.stage_instance_id;
      
      -- Find and activate the next pending stage
      SELECT id INTO v_next_stage_id
      FROM job_stage_instances
      WHERE job_id = v_job_rec.job_id
        AND job_table_name = v_job_rec.job_table_name
        AND status = 'pending'
        AND stage_order > v_job_rec.stage_order
      ORDER BY stage_order ASC
      LIMIT 1;
      
      IF v_next_stage_id IS NOT NULL THEN
        UPDATE job_stage_instances
        SET 
          status = 'active',
          started_at = NOW(),
          updated_at = NOW()
        WHERE id = v_next_stage_id;
      END IF;
      
      v_completed_count := v_completed_count + 1;
      
      RAISE NOTICE '  ✅ Job % pending DTP completed and next stage activated', v_job_rec.wo_no;
      
      INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        v_job_rec.job_id,
        v_job_rec.wo_no,
        'bulk_dtp_direct_SUCCESS',
        format('Pending DTP activated and completed. Stage instance: %s', v_job_rec.stage_instance_id)
      );
      
    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      v_failed_count := v_failed_count + 1;
      
      RAISE WARNING '  ❌ FAILED: Job % - %', v_job_rec.wo_no, v_error_msg;
      
      INSERT INTO batch_allocation_logs (job_id, wo_no, action, details)
      VALUES (
        v_job_rec.job_id,
        v_job_rec.wo_no,
        'bulk_dtp_direct_ERROR',
        format('FAILED: %s', v_error_msg)
      );
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 Pending Results: %s completed, %s failed', v_completed_count, v_failed_count;
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ DIRECT BULK DTP COMPLETION FINISHED';
  RAISE NOTICE '========================================';
  
END $$;

-- Verification: Check remaining DTP stages
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