-- Update validate_job_scheduling_precedence to handle parallel processing correctly
-- This function now understands 'cover', 'text', and 'both' part assignments

CREATE OR REPLACE FUNCTION public.validate_job_scheduling_precedence(p_job_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(job_id uuid, violation_type text, stage1_name text, stage1_order integer, stage1_start timestamp with time zone, stage1_end timestamp with time zone, stage2_name text, stage2_order integer, stage2_start timestamp with time zone, stage2_end timestamp with time zone, violation_details text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH job_stage_slots AS (
    SELECT 
      jsi.job_id,
      jsi.stage_order,
      jsi.part_assignment,
      ps.name as stage_name,
      MIN(sts.slot_start_time) as earliest_start,
      MAX(sts.slot_end_time) as latest_end
    FROM job_stage_instances jsi
    JOIN production_stages ps ON jsi.production_stage_id = ps.id
    JOIN stage_time_slots sts ON sts.stage_instance_id = jsi.id
    WHERE (p_job_ids IS NULL OR jsi.job_id = ANY(p_job_ids))
      AND sts.slot_start_time IS NOT NULL
      AND sts.slot_end_time IS NOT NULL
      -- CRITICAL FIX: Exclude DTP and Proof stages from validation
      AND ps.name NOT ILIKE '%DTP%' AND ps.name NOT ILIKE '%proof%'
    GROUP BY jsi.job_id, jsi.stage_order, jsi.part_assignment, ps.name
  ),
  -- Validate within same part assignment path (cover->cover, text->text)
  same_part_violations AS (
    SELECT 
      s1.job_id,
      'same_part_precedence_violation' as violation_type,
      s1.stage_name as stage1_name,
      s1.stage_order as stage1_order,
      s1.earliest_start as stage1_start,
      s1.latest_end as stage1_end,
      s2.stage_name as stage2_name,
      s2.stage_order as stage2_order,
      s2.earliest_start as stage2_start,
      s2.latest_end as stage2_end,
      format('Within %s path: Stage %s (order %s) starts at %s but depends on stage %s (order %s) which ends at %s',
             COALESCE(s1.part_assignment, 'default'), s2.stage_name, s2.stage_order, s2.earliest_start,
             s1.stage_name, s1.stage_order, s1.latest_end) as violation_details
    FROM job_stage_slots s1
    JOIN job_stage_slots s2 ON s1.job_id = s2.job_id
    WHERE s1.stage_order < s2.stage_order  -- s1 should complete before s2 starts
      AND s1.latest_end > s2.earliest_start  -- but s1 ends after s2 starts (violation!)
      -- CRITICAL: Only validate within same part assignment or when both are null
      AND (s1.part_assignment = s2.part_assignment 
           OR (s1.part_assignment IS NULL AND s2.part_assignment IS NULL))
  ),
  -- Validate 'both' stages wait for all prerequisite parts
  convergence_violations AS (
    SELECT 
      s_both.job_id,
      'convergence_precedence_violation' as violation_type,
      s_part.stage_name as stage1_name,
      s_part.stage_order as stage1_order,
      s_part.earliest_start as stage1_start,
      s_part.latest_end as stage1_end,
      s_both.stage_name as stage2_name,
      s_both.stage_order as stage2_order,
      s_both.earliest_start as stage2_start,
      s_both.latest_end as stage2_end,
      format('Convergence violation: %s stage "%s" (order %s) starts at %s before prerequisite %s stage "%s" (order %s) ends at %s',
             COALESCE(s_both.part_assignment, 'both'), s_both.stage_name, s_both.stage_order, s_both.earliest_start,
             COALESCE(s_part.part_assignment, 'default'), s_part.stage_name, s_part.stage_order, s_part.latest_end) as violation_details
    FROM job_stage_slots s_both
    JOIN job_stage_slots s_part ON s_both.job_id = s_part.job_id
    WHERE s_both.part_assignment = 'both'  -- 'both' stages must wait for all parts
      AND s_part.part_assignment IN ('cover', 'text')  -- Check against specific part stages
      AND s_part.stage_order < s_both.stage_order  -- Part stage should complete before 'both' stage
      AND s_part.latest_end > s_both.earliest_start  -- but part ends after 'both' starts (violation!)
  ),
  all_violations AS (
    SELECT * FROM same_part_violations
    UNION ALL
    SELECT * FROM convergence_violations
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
  FROM all_violations v
  ORDER BY v.job_id, v.stage1_order, v.stage2_order;
END;
$function$;