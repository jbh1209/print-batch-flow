-- ============================================================================
-- SCHEDULER RESTORATION PART 3 - Wrapper Functions and Phase 2
-- ============================================================================
-- This file contains:
-- - Complete Phase 2 gap-filling logic (to be added to scheduler function)
-- - simple_scheduler_wrapper
-- - cron_nightly_reschedule_with_carryforward
-- ============================================================================

-- ============================================================================
-- PHASE 2 GAP-FILLING CODE TO BE INSERTED INTO scheduler_reschedule_all_parallel_aware
-- ============================================================================
-- NOTE: This code should be inserted in the main scheduler function before
--       the final RETURN QUERY statement. It's extracted here for reference.
-- ============================================================================

/*
  -- PHASE 2: GAP-FILLING WITH PART-AWARE PREDECESSOR CHECK
  RAISE NOTICE '🔀 Phase 2: Gap-Filling with multi-pass convergence (up to 3 iterations)';
  
  v_lookback_days := 90;
  
  FOR pass_iteration IN 1..3 LOOP
    moved_count := 0;
    
    RAISE NOTICE '🔀 Phase 2 Pass %/3 starting...', pass_iteration;
    
    FOR gap_candidate IN
      SELECT 
        jsi.id as stage_instance_id,
        jsi.job_id,
        jsi.production_stage_id,
        jsi.scheduled_start_at,
        jsi.scheduled_end_at,
        jsi.scheduled_minutes,
        jsi.stage_order,
        jsi.part_assignment,
        ps.name as stage_name,
        ps.allow_gap_filling,
        pj.wo_no
      FROM job_stage_instances jsi
      JOIN production_stages ps ON ps.id = jsi.production_stage_id
      JOIN production_jobs pj ON pj.id = jsi.job_id
      WHERE jsi.schedule_status = 'scheduled'
        AND ps.allow_gap_filling = true
        AND jsi.scheduled_minutes IS NOT NULL
        AND jsi.scheduled_minutes <= 120
        AND jsi.scheduled_start_at IS NOT NULL
      ORDER BY 
        jsi.job_id,
        jsi.stage_order ASC,
        jsi.scheduled_start_at ASC
    LOOP
      original_start := gap_candidate.scheduled_start_at;
      
      -- CRITICAL: Calculate earliest_possible_start WITH PART-AWARE FILTERING
      SELECT COALESCE(MAX(jsi2.scheduled_end_at), base_time)
      INTO earliest_possible_start
      FROM job_stage_instances jsi2
      WHERE jsi2.job_id = gap_candidate.job_id
        AND jsi2.stage_order < gap_candidate.stage_order
        AND jsi2.scheduled_end_at IS NOT NULL
        AND (
          -- If current stage is 'both', wait for everything (convergence point)
          gap_candidate.part_assignment = 'both'
          OR
          -- If current stage is 'text', only wait for text and both stages
          (COALESCE(gap_candidate.part_assignment, 'main') = 'text' 
           AND jsi2.part_assignment IN ('text', 'both'))
          OR
          -- If current stage is 'cover', only wait for cover and both stages
          (COALESCE(gap_candidate.part_assignment, 'main') = 'cover' 
           AND jsi2.part_assignment IN ('cover', 'both'))
          OR
          -- If current stage is 'main' (or NULL), wait for main and both stages
          (COALESCE(gap_candidate.part_assignment, 'main') = 'main' 
           AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
        );

      RAISE NOTICE '🔍 Part-aware predecessor check for % (part=%): earliest_possible=% (only checked %+both predecessors)',
        gap_candidate.stage_name, COALESCE(gap_candidate.part_assignment, 'main'), 
        earliest_possible_start, COALESCE(gap_candidate.part_assignment, 'main');
      
      SELECT * INTO best_gap
      FROM find_available_gaps(
        gap_candidate.production_stage_id,
        gap_candidate.scheduled_minutes,
        original_start,
        v_lookback_days,
        earliest_possible_start
      )
      WHERE gap_start >= earliest_possible_start
      ORDER BY gap_start ASC
      LIMIT 1;
      
      IF best_gap IS NOT NULL 
         AND best_gap.gap_start >= earliest_possible_start 
         AND best_gap.gap_start < original_start THEN
        
        days_saved := EXTRACT(EPOCH FROM (original_start - best_gap.gap_start)) / 86400.0;
        
        RAISE NOTICE '🔀 GAP-FILLING Pass %: Moving stage % (WO: %, order %, part=%) from % to % (saves %.2f days)',
          pass_iteration, gap_candidate.stage_name, gap_candidate.wo_no, gap_candidate.stage_order,
          COALESCE(gap_candidate.part_assignment, 'main'), original_start, best_gap.gap_start, days_saved;
        
        DELETE FROM stage_time_slots 
        WHERE stage_instance_id = gap_candidate.stage_instance_id
          AND COALESCE(is_completed, false) = false;
        
        SELECT * INTO placement_result
        FROM public.place_duration_sql(
          best_gap.gap_start,
          gap_candidate.scheduled_minutes,
          60
        );
        
        IF placement_result.placement_success THEN
          FOR slot_record IN SELECT * FROM jsonb_array_elements(placement_result.slots_created)
          LOOP
            INSERT INTO stage_time_slots(
              production_stage_id, date, slot_start_time, slot_end_time,
              duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
            )
            VALUES (
              gap_candidate.production_stage_id,
              (slot_record ->> 'date')::date,
              (slot_record ->> 'start_time')::timestamptz,
              (slot_record ->> 'end_time')::timestamptz,
              (slot_record ->> 'duration_minutes')::integer,
              gap_candidate.job_id, 'production_jobs', gap_candidate.stage_instance_id, false
            )
            ON CONFLICT (production_stage_id, slot_start_time) DO NOTHING;
            
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            IF v_rows = 0 THEN
              RAISE NOTICE '⏭️ Phase 2 skipped conflicting slot: stage %, start %', 
                gap_candidate.production_stage_id, (slot_record->>'start_time')::timestamptz;
            END IF;
          END LOOP;
          
          SELECT MIN(slot_start_time), MAX(slot_end_time)
          INTO stage_start_time, gap_filled_end
          FROM stage_time_slots
          WHERE stage_instance_id = gap_candidate.stage_instance_id
            AND COALESCE(is_completed, false) = false;
          
          IF gap_filled_end IS NOT NULL THEN
            UPDATE job_stage_instances
            SET 
              scheduled_start_at = stage_start_time,
              scheduled_end_at = gap_filled_end,
              updated_at = now()
            WHERE id = gap_candidate.stage_instance_id;
            
            INSERT INTO schedule_gap_fills(
              job_id, stage_instance_id, production_stage_id,
              original_scheduled_start, gap_filled_start, days_saved,
              minutes_saved, scheduler_run_type
            )
            VALUES (
              gap_candidate.job_id, gap_candidate.stage_instance_id, gap_candidate.production_stage_id,
              original_start, best_gap.gap_start, days_saved,
              (days_saved * 1440)::integer, 'reschedule_all'
            );
            
            gap_filled_count := gap_filled_count + 1;
            moved_count := moved_count + 1;
          END IF;
        END IF;
      END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Phase 2 Pass %/3 complete: % stages moved in this pass', pass_iteration, moved_count;
    
    IF moved_count = 0 THEN
      RAISE NOTICE '🎯 Phase 2 converged after % passes', pass_iteration;
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Phase 2 complete: % total stages gap-filled', gap_filled_count;
  RAISE NOTICE '📊 FINAL: % total slots written, % stages updated, % gap-filled', wrote_count, updated_count, gap_filled_count;
*/

-- ============================================================================
-- 4. simple_scheduler_wrapper
-- ============================================================================
-- PURPOSE: Wrapper function for scheduler invocation
-- FEATURES: Timeout protection, mode selection, response formatting
-- USED BY: Edge functions and manual scheduler calls
-- ============================================================================

CREATE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all'::text, 
  p_start_from timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '180s'
SET idle_in_transaction_session_timeout TO '300s'
AS $$
DECLARE
  result record;
  response jsonb;
BEGIN
  SET LOCAL statement_timeout = '120s';
  SET LOCAL idle_in_transaction_session_timeout = '300s';
  
  CASE p_mode
    WHEN 'reschedule_all' THEN
      SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware(p_start_from);
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'violations', result.violations,
        'mode', 'parallel_aware'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  RETURN response;
END;
$$;

ALTER FUNCTION public.simple_scheduler_wrapper(p_mode text, p_start_from timestamp with time zone) OWNER TO postgres;

COMMENT ON FUNCTION public.simple_scheduler_wrapper IS 'WORKING VERSION: Oct 24-25, 2025 - Wrapper for scheduler invocation with timeout protection';

-- ============================================================================
-- 5. cron_nightly_reschedule_with_carryforward
-- ============================================================================
-- PURPOSE: Nightly cron job function
-- FEATURES:
--   - Carries forward overdue jobs from Approved to In Production
--   - Calls simple-scheduler edge function with nuclear reschedule
--   - Logs start and completion
-- SCHEDULED: 3 AM daily (via cron.schedule)
-- ============================================================================

CREATE FUNCTION public.cron_nightly_reschedule_with_carryforward() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  response_id bigint;
  service_key text;
BEGIN
  RAISE NOTICE '🌙 Nightly cron starting at %', now();
  
  -- Carry forward overdue jobs
  UPDATE production_jobs 
  SET status = 'In Production'
  WHERE status = 'Approved' 
    AND due_date < CURRENT_DATE;
  
  RAISE NOTICE '📞 Calling simple-scheduler edge function (nuclear reschedule)';
  
  -- Get service role key from secrets table
  SELECT value INTO service_key
  FROM public._app_secrets
  WHERE key = 'service_role_key';
  
  IF service_key IS NULL THEN
    RAISE WARNING '⚠️ Service role key not found in _app_secrets table';
    RETURN;
  END IF;
  
  -- Call the simple-scheduler edge function (same payload as UI "Reschedule All" button)
  SELECT net.http_post(
    url := 'https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/simple-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'commit', true,
      'proposed', false,
      'onlyIfUnset', false,
      'nuclear', true,
      'wipeAll', true
    )
  ) INTO response_id;
  
  RAISE NOTICE '✅ Edge function called, response_id: %', response_id;
END;
$$;

ALTER FUNCTION public.cron_nightly_reschedule_with_carryforward() OWNER TO postgres;

COMMENT ON FUNCTION public.cron_nightly_reschedule_with_carryforward IS 'WORKING VERSION: Oct 24-25, 2025 - Nightly cron job for carry-forward and reschedule';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after restoration to verify the functions are working
-- ============================================================================

-- Test simple_scheduler_wrapper (dry run)
-- SELECT * FROM simple_scheduler_wrapper('reschedule_all', now() + interval '1 day');

-- Check function definitions exist
-- SELECT proname, pg_get_functiondef(oid) 
-- FROM pg_proc 
-- WHERE proname IN (
--   'scheduler_reschedule_all_parallel_aware',
--   'find_available_gaps',
--   'simple_scheduler_wrapper',
--   'cron_nightly_reschedule_with_carryforward',
--   'place_duration_sql'
-- );
