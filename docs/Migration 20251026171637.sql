-- Drop and recreate wrapper with new signature
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper(text);

CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_division text DEFAULT NULL,
  p_start_from timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  validation_results jsonb;
BEGIN
  RAISE NOTICE 'Simple scheduler wrapper called for division: %, start_from: %', COALESCE(p_division, 'ALL'), p_start_from;
  
  -- Call the NEW division-aware scheduler
  result := public.scheduler_reschedule_all_by_division(p_division, p_start_from);
  
  -- Get validation results
  SELECT jsonb_agg(
    jsonb_build_object(
      'job_id', v.job_id,
      'violation_type', v.violation_type,
      'stage1_name', v.stage1_name,
      'stage1_order', v.stage1_order,
      'stage2_name', v.stage2_name,
      'stage2_order', v.stage2_order,
      'violation_details', v.violation_details
    )
  ) INTO validation_results
  FROM public.validate_job_scheduling_precedence() v;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_jsi', result->'updated_jsi',
    'wrote_slots', result->'wrote_slots',
    'violations', COALESCE(validation_results, '[]'::jsonb),
    'division', p_division
  );
END;
$$;