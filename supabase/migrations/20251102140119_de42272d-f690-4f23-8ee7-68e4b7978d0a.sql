-- Fix cron_nightly_reschedule_with_carryforward to call scheduler_resource_fill_optimized directly
-- This restores the October 24th behavior for the 3 AM cron job

DROP FUNCTION IF EXISTS public.cron_nightly_reschedule_with_carryforward();

CREATE OR REPLACE FUNCTION public.cron_nightly_reschedule_with_carryforward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  carry_result jsonb;
  schedule_result jsonb;
  carried_count int;
  updated_jsi int;
  wrote_slots int;
BEGIN
  RAISE NOTICE '🌙 Nightly cron: carry forward + reschedule starting...';

  -- Step 1: Carry forward overdue active jobs
  SELECT jsonb_agg(result) INTO carry_result
  FROM public.carry_forward_overdue_active_jobs() AS result;

  carried_count := COALESCE((carry_result->0->>'carried_forward_count')::int, 0);
  RAISE NOTICE '✅ Carried forward % overdue jobs', carried_count;

  -- Step 2: Call the Oct 24th resource-fill scheduler directly
  RAISE NOTICE '📅 Running scheduler_resource_fill_optimized()...';
  
  SELECT result INTO schedule_result
  FROM public.scheduler_resource_fill_optimized() AS result;

  updated_jsi := COALESCE((schedule_result->>'updated_jsi')::int, 0);
  wrote_slots := COALESCE((schedule_result->>'wrote_slots')::int, 0);

  RAISE NOTICE '✅ Scheduled % stages with % slots', updated_jsi, wrote_slots;

  RETURN jsonb_build_object(
    'success', true,
    'carried_forward', carried_count,
    'updated_jsi', updated_jsi,
    'wrote_slots', wrote_slots,
    'timestamp', now()
  );
END;
$$;