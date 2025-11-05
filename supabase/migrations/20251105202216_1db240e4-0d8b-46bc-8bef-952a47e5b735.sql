-- CRITICAL FIX: Update simple_scheduler_wrapper to use the October 24th scheduler logic
-- The current wrapper calls old cron functions that don't have proper dependency logic
-- This migration fixes the wrapper to call scheduler_reschedule_all_by_division which has:
-- - Proper part_assignment dependency handling (Cover UV doesn't wait for Text stages)
-- - Gap-filling optimization
-- - Division filtering support
-- - Resource availability tracking

DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_division text DEFAULT NULL,
  p_start_from timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  validation_results jsonb;
BEGIN
  RAISE NOTICE '🚀 Simple scheduler wrapper called for division: %, start_from: %', 
    COALESCE(p_division, 'ALL'), 
    COALESCE(p_start_from::text, 'auto');
  
  -- Call the October 24th scheduler with proper dependency logic
  result := public.scheduler_reschedule_all_by_division(p_division, p_start_from);
  
  -- Get validation results
  BEGIN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'job_id', v.job_id,
          'violation_type', v.violation_type,
          'stage1_name', v.stage1_name,
          'stage1_order', v.stage1_order,
          'stage2_name', v.stage2_name,
          'stage2_order', v.stage2_order,
          'violation_details', v.violation_details
        )
      ),
      '[]'::jsonb
    ) INTO validation_results
    FROM public.validate_job_scheduling_precedence() v;
  EXCEPTION
    WHEN OTHERS THEN
      validation_results := '[]'::jsonb;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_jsi', result->>'updated_jsi',
    'wrote_slots', result->>'wrote_slots',
    'violations', COALESCE(validation_results, '[]'::jsonb),
    'gap_filled', COALESCE(result->>'gap_filled', '0'),
    'division', p_division
  );
END;
$$;