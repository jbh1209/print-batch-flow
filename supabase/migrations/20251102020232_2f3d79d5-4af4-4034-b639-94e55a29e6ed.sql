-- ========================================
-- COMPLETE DIVISION ROLLBACK - FINAL CLEANUP
-- Drop all division-aware function overloads
-- ========================================

-- 1. Drop division-aware scheduler functions
DROP FUNCTION IF EXISTS public.export_scheduler_input(p_division text);
DROP FUNCTION IF EXISTS public.scheduler_append_jobs(p_job_ids uuid[], p_only_if_unset boolean, p_division text);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(p_division text);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_sequential_fixed(p_start_from timestamp with time zone, p_division text);

-- 2. Drop division-aware initialization functions
DROP FUNCTION IF EXISTS public.initialize_job_stages(p_job_id uuid, p_job_table_name text, p_user_id uuid, p_division text);
DROP FUNCTION IF EXISTS public.initialize_job_stages_auto(p_job_id uuid, p_job_table_name text, p_user_id uuid, p_division text);
DROP FUNCTION IF EXISTS public.initialize_job_stages_with_multi_specs(p_job_id uuid, p_job_table_name text, p_user_id uuid, p_division text);
DROP FUNCTION IF EXISTS public.initialize_custom_job_stages(p_job_id uuid, p_job_table_name text, p_stage_ids uuid[], p_user_id uuid, p_division text);

-- 3. Drop division-aware user access function
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_batch_allocation(p_user_id uuid, p_permission_type text, p_status_filter text, p_stage_filter text);

-- 4. Recreate trigger functions WITHOUT division references
CREATE OR REPLACE FUNCTION public.trigger_schedule_on_job_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a job is approved, schedule it
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    PERFORM public.scheduler_append_jobs(
      ARRAY[NEW.id],
      true  -- only_if_unset
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_schedule_on_proof_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When proof is approved, schedule the job
  IF NEW.proof_approved_at IS NOT NULL AND (OLD.proof_approved_at IS NULL) THEN
    PERFORM public.scheduler_append_jobs(
      ARRAY[NEW.id],
      true  -- only_if_unset
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Verify cleanup
DO $$
DECLARE
  division_count integer;
BEGIN
  SELECT COUNT(*) INTO division_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  AND lower(pg_get_functiondef(p.oid)) LIKE '%division%';
  
  RAISE NOTICE 'Functions still containing "division": %', division_count;
END $$;