-- Enhance HP12000 stages function to include part assignments and specifications
CREATE OR REPLACE FUNCTION get_job_hp12000_stages(p_job_id UUID)
RETURNS TABLE(
  stage_instance_id UUID,
  production_stage_id UUID,
  stage_name TEXT,
  stage_order INTEGER,
  paper_size_id UUID,
  paper_size_name TEXT,
  is_paper_size_required BOOLEAN,
  part_assignment TEXT,
  part_name TEXT,
  paper_specifications JSONB,
  printing_specifications JSONB,
  suggested_paper_size_id UUID,
  suggested_paper_size_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH job_specs AS (
    SELECT 
      pj.id,
      pj.paper_specifications,
      pj.printing_specifications
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
      js.paper_specifications,
      js.printing_specifications,
      -- Smart paper size detection based on specifications
      CASE 
        -- Look for specific dimensions in paper specs
        WHEN js.paper_specifications::text ~* '640.*915|915.*640' THEN (SELECT id FROM hp12000_paper_sizes WHERE name LIKE '%Small%' LIMIT 1)
        WHEN js.paper_specifications::text ~* '530.*750|750.*530' THEN (SELECT id FROM hp12000_paper_sizes WHERE name LIKE '%Large%' LIMIT 1)
        -- Look for part-specific specs
        WHEN jsi.part_assignment = 'cover' AND js.printing_specifications::text ~* 'cover.*640|small' THEN (SELECT id FROM hp12000_paper_sizes WHERE name LIKE '%Small%' LIMIT 1)
        WHEN jsi.part_assignment = 'cover' AND js.printing_specifications::text ~* 'cover.*750|large' THEN (SELECT id FROM hp12000_paper_sizes WHERE name LIKE '%Large%' LIMIT 1)
        WHEN jsi.part_assignment = 'text' AND js.printing_specifications::text ~* 'text.*640|small' THEN (SELECT id FROM hp12000_paper_sizes WHERE name LIKE '%Small%' LIMIT 1)  
        WHEN jsi.part_assignment = 'text' AND js.printing_specifications::text ~* 'text.*750|large' THEN (SELECT id FROM hp12000_paper_sizes WHERE name LIKE '%Large%' LIMIT 1)
        -- Default to Large if no specific match
        ELSE (SELECT id FROM hp12000_paper_sizes WHERE name LIKE '%Large%' LIMIT 1)
      END as suggested_paper_size_id
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
    sd.paper_specifications,
    sd.printing_specifications,
    sd.suggested_paper_size_id,
    shps.name as suggested_paper_size_name
  FROM stage_data sd
  LEFT JOIN hp12000_paper_sizes shps ON shps.id = sd.suggested_paper_size_id
  ORDER BY sd.stage_order, sd.part_assignment NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;