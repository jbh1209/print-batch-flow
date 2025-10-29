-- Restore a compatible scheduler wrapper that the Edge Function expects
-- Create a parameter-compatible wrapper that calls division-aware scheduler when available
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_commit boolean DEFAULT true,
  p_proposed boolean DEFAULT false,
  p_only_if_unset boolean DEFAULT false,
  p_nuclear boolean DEFAULT false,
  p_start_from timestamp with time zone DEFAULT NULL,
  p_only_job_ids uuid[] DEFAULT NULL,
  p_division text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_json jsonb;
  v_row record;
BEGIN
  -- Prefer division-aware function if present
  BEGIN
    SELECT public.scheduler_reschedule_all_by_division(p_division, p_start_from)
    INTO v_json;

    IF v_json IS NOT NULL THEN
      RETURN jsonb_build_object(
        'wrote_slots', COALESCE((v_json->>'wrote_slots')::int, 0),
        'updated_jsi', COALESCE((v_json->>'updated_jsi')::int, 0),
        'violations', COALESCE(v_json->'violations', '[]'::jsonb)
      );
    END IF;
  EXCEPTION WHEN undefined_function THEN
    -- Fall through to legacy scheduler
    NULL;
  END;

  -- Fallback to the parallel-aware sequential scheduler (TABLE return)
  SELECT * INTO v_row FROM public.scheduler_reschedule_all_parallel_aware(p_start_from);

  RETURN jsonb_build_object(
    'wrote_slots', COALESCE(v_row.wrote_slots, 0),
    'updated_jsi', COALESCE(v_row.updated_jsi, 0),
    'violations', COALESCE(v_row.violations, '[]'::jsonb)
  );

EXCEPTION WHEN OTHERS THEN
  -- Never break callers; return structured error
  RETURN jsonb_build_object(
    'wrote_slots', 0,
    'updated_jsi', 0,
    'violations', '[]'::jsonb,
    'error', SQLERRM
  );
END;
$$;