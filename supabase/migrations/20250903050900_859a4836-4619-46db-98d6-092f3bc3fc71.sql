-- Disable the current precedence trigger that's causing scheduling issues
DROP TRIGGER IF EXISTS ct_check_stage_precedence_insupd ON stage_time_slots;

-- Create a comprehensive post-scheduling validation function
CREATE OR REPLACE FUNCTION public.validate_job_scheduling_precedence(p_job_ids uuid[] DEFAULT NULL)
RETURNS TABLE(
  job_id uuid,
  violation_type text,
  stage1_name text,
  stage1_order integer,
  stage1_start timestamptz,
  stage1_end timestamptz,
  stage2_name text,
  stage2_order integer,
  stage2_start timestamptz,
  stage2_end timestamptz,
  violation_details text
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH job_stage_slots AS (
    SELECT 
      jsi.job_id,
      jsi.stage_order,
      ps.name as stage_name,
      MIN(sts.slot_start_time) as earliest_start,
      MAX(sts.slot_end_time) as latest_end
    FROM job_stage_instances jsi
    JOIN production_stages ps ON jsi.production_stage_id = ps.id
    JOIN stage_time_slots sts ON sts.stage_instance_id = jsi.id
    WHERE (p_job_ids IS NULL OR jsi.job_id = ANY(p_job_ids))
      AND sts.slot_start_time IS NOT NULL
      AND sts.slot_end_time IS NOT NULL
    GROUP BY jsi.job_id, jsi.stage_order, ps.name
  ),
  violations AS (
    SELECT 
      s1.job_id,
      'precedence_violation' as violation_type,
      s1.stage_name as stage1_name,
      s1.stage_order as stage1_order,
      s1.earliest_start as stage1_start,
      s1.latest_end as stage1_end,
      s2.stage_name as stage2_name,
      s2.stage_order as stage2_order,
      s2.earliest_start as stage2_start,
      s2.latest_end as stage2_end,
      format('Stage %s (order %s) starts at %s but depends on stage %s (order %s) which ends at %s',
             s2.stage_name, s2.stage_order, s2.earliest_start,
             s1.stage_name, s1.stage_order, s1.latest_end) as violation_details
    FROM job_stage_slots s1
    JOIN job_stage_slots s2 ON s1.job_id = s2.job_id
    WHERE s1.stage_order < s2.stage_order  -- s1 should complete before s2 starts
      AND s1.latest_end > s2.earliest_start  -- but s1 ends after s2 starts (violation!)
  )
  SELECT 
    v.job_id,
    v.violation_type,
    v.stage1_name,
    v.stage1_order,
    v.stage1_start,
    v.stage1_end,
    v.stage2_name,
    v.stage2_order,
    v.stage2_start,
    v.stage2_end,
    v.violation_details
  FROM violations v
  ORDER BY v.job_id, v.stage1_order, v.stage2_order;
END;
$function$;