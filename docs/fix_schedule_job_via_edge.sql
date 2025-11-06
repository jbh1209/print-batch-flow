-- ============================================================
-- FIX: Update _schedule_job_via_edge to use scheduler_append_jobs RPC
-- ============================================================
-- Current function calls non-existent 'scheduler-run' edge function
-- Updating to call scheduler_append_jobs RPC directly (same as other triggers)
-- ============================================================

DROP FUNCTION IF EXISTS public._schedule_job_via_edge(uuid, text) CASCADE;

CREATE FUNCTION public._schedule_job_via_edge(p_job_id uuid, p_event text DEFAULT 'auto'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result record;
  v_error_msg text;
  v_resp jsonb;
BEGIN
  BEGIN
    RAISE NOTICE '🚀 Scheduling job % via RPC (event: %)', p_job_id, p_event;
    
    -- Call scheduler_append_jobs RPC directly
    SELECT * INTO result FROM public.scheduler_append_jobs(
      ARRAY[p_job_id]::uuid[],
      true  -- only_if_unset = true for append-only behavior
    );
    
    RAISE NOTICE '✅ Scheduler append completed for job %: wrote_slots=%, updated_jsi=%', 
      p_job_id, result.wrote_slots, result.updated_jsi;
    
    -- Log to scheduler_webhook_log
    INSERT INTO public.scheduler_webhook_log(
      created_at, event, job_id, order_no,
      request_id, http_status, response_excerpt, http_error, request_body
    )
    SELECT
      NOW(), COALESCE(p_event,'auto'), pj.id, pj.wo_no,
      NULL,
      200,
      format('Appended via RPC. Slots: %s, Stages: %s', 
        COALESCE(result.wrote_slots::text, '0'), 
        COALESCE(result.updated_jsi::text, '0')),
      '',
      jsonb_build_object(
        'method', 'RPC',
        'function', 'scheduler_append_jobs',
        'job_id', p_job_id,
        'only_if_unset', true
      )
    FROM public.production_jobs pj
    WHERE pj.id = p_job_id;
    
    v_resp := jsonb_build_object(
      'ok', true,
      'wrote_slots', COALESCE(result.wrote_slots, 0),
      'updated_jsi', COALESCE(result.updated_jsi, 0)
    );
    
  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    RAISE WARNING '❌ Scheduler append FAILED for job %: %', p_job_id, v_error_msg;
    
    -- Log error to scheduler_webhook_log
    INSERT INTO public.scheduler_webhook_log(
      created_at, event, job_id, order_no,
      request_id, http_status, response_excerpt, http_error, request_body
    )
    SELECT
      NOW(), COALESCE(p_event,'auto'), pj.id, pj.wo_no,
      NULL,
      500,
      '',
      v_error_msg,
      jsonb_build_object('method', 'RPC', 'function', 'scheduler_append_jobs', 'job_id', p_job_id)
    FROM public.production_jobs pj
    WHERE pj.id = p_job_id;
    
    v_resp := jsonb_build_object(
      'ok', false,
      'error', v_error_msg
    );
  END;
  
  RETURN v_resp;
END $function$;

ALTER FUNCTION public._schedule_job_via_edge(p_job_id uuid, p_event text) OWNER TO postgres;

-- ============================================================
-- CLEANUP: Remove scheduler-run from config.toml
-- ============================================================
-- The scheduler-run edge function doesn't exist and is no longer needed
-- since we're using RPC calls directly. Remove from supabase/config.toml:
--
-- [functions.scheduler-run]
-- verify_jwt = false
