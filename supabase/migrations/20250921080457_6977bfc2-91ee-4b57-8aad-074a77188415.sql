-- Remove suggested paper size functionality from get_job_hp12000_stages function
CREATE OR REPLACE FUNCTION public.get_job_hp12000_stages(p_job_id uuid)
 RETURNS TABLE(stage_instance_id uuid, production_stage_id uuid, stage_name text, stage_order integer, paper_size_id uuid, paper_size_name text, is_paper_size_required boolean, part_assignment text, part_name text, paper_specifications jsonb, printing_specifications jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH job_specs AS (
    SELECT 
      pj.id,
      pj.paper_specifications as full_paper_specs,
      pj.printing_specifications as full_printing_specs
    FROM production_jobs pj
    WHERE pj.id = p_job_id
  ),
  stage_data AS (
    SELECT 
      jsi.id as stage_instance_id,
      jsi.production_stage_id,
      ps.name as stage_name,
      jsi.stage_order,
      jsi.hp12000_paper_size_id as paper_size_id,
      hps.name as paper_size_name,
      is_hp12000_stage(ps.name) as is_paper_size_required,
      jsi.part_assignment,
      jsi.part_name,
      -- Extract part-specific specifications based on part_assignment
      CASE 
        WHEN jsi.part_assignment = 'cover' THEN
          (SELECT jsonb_object_agg(
            REPLACE(key, '_Cover', ''), value
          ) FROM jsonb_each(js.full_paper_specs) WHERE key LIKE '%_Cover')
        WHEN jsi.part_assignment = 'text' THEN
          (SELECT jsonb_object_agg(
            REPLACE(key, '_Text', ''), value
          ) FROM jsonb_each(js.full_paper_specs) WHERE key LIKE '%_Text')
        WHEN jsi.part_assignment = 'both' OR jsi.part_assignment IS NULL THEN
          js.full_paper_specs
        ELSE
          '{}'::jsonb
      END as filtered_paper_specs,
      CASE 
        WHEN jsi.part_assignment = 'cover' THEN
          (SELECT jsonb_object_agg(
            REPLACE(key, '_Cover', ''), value
          ) FROM jsonb_each(js.full_printing_specs) WHERE key LIKE '%_Cover')
        WHEN jsi.part_assignment = 'text' THEN
          (SELECT jsonb_object_agg(
            REPLACE(key, '_Text', ''), value
          ) FROM jsonb_each(js.full_printing_specs) WHERE key LIKE '%_Text')
        WHEN jsi.part_assignment = 'both' OR jsi.part_assignment IS NULL THEN
          js.full_printing_specs
        ELSE
          '{}'::jsonb
      END as filtered_printing_specs
    FROM job_stage_instances jsi
    JOIN production_stages ps ON ps.id = jsi.production_stage_id
    LEFT JOIN hp12000_paper_sizes hps ON hps.id = jsi.hp12000_paper_size_id
    CROSS JOIN job_specs js
    WHERE jsi.job_id = p_job_id
      AND jsi.job_table_name = 'production_jobs'
      AND is_hp12000_stage(ps.name) = true
  )
  SELECT 
    sd.stage_instance_id,
    sd.production_stage_id,
    sd.stage_name,
    sd.stage_order,
    sd.paper_size_id,
    sd.paper_size_name,
    sd.is_paper_size_required,
    sd.part_assignment,
    sd.part_name,
    COALESCE(sd.filtered_paper_specs, '{}'::jsonb) as paper_specifications,
    COALESCE(sd.filtered_printing_specs, '{}'::jsonb) as printing_specifications
  FROM stage_data sd
  ORDER BY sd.stage_order, sd.part_assignment NULLS LAST;
END;
$function$