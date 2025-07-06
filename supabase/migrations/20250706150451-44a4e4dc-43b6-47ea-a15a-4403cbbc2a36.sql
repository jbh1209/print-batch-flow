-- Fix multi-part concurrent workflow issues (corrected approach)

-- 1. Set up laminating as master queue for covers workflow
UPDATE public.production_stages 
SET master_queue_id = (
  SELECT id FROM public.production_stages 
  WHERE name = 'Laminating Queue' 
  LIMIT 1
)
WHERE name ILIKE '%laminating%cover%' OR name = 'Laminating - Cover';

-- 2. Ensure printing stages allow concurrent start
UPDATE public.production_stages 
SET allows_concurrent_start = true,
    is_multi_part = true,
    part_definitions = '["covers", "text"]'::jsonb
WHERE name ILIKE '%printing%' 
  AND name NOT ILIKE '%queue%'
  AND name NOT ILIKE '%laminating%';

-- 3. Update finishing stages to require all parts complete
UPDATE public.production_stages 
SET requires_all_parts_complete = true
WHERE name ILIKE ANY(ARRAY['%finishing%', '%gathering%', '%binding%', '%cutting%', '%folding%']);

-- 4. Update existing job stage instances for concurrent workflow
UPDATE public.job_stage_instances
SET 
  concurrent_stage_group_id = gen_random_uuid(),
  allows_concurrent_start = true,
  part_name = COALESCE(part_name, 'covers'),
  updated_at = now()
WHERE production_stage_id IN (
  SELECT id FROM public.production_stages 
  WHERE name ILIKE '%printing%' 
    AND allows_concurrent_start = true
)
AND concurrent_stage_group_id IS NULL
AND status IN ('pending', 'active');

-- 5. Create enhanced function to initialize jobs with proper concurrent workflow
CREATE OR REPLACE FUNCTION public.initialize_job_stages_auto(
  p_job_id UUID,
  p_job_table_name TEXT,
  p_category_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_record RECORD;
  concurrent_group_id UUID;
  first_stage BOOLEAN := true;
BEGIN
  -- Check if this category has multi-part stages
  IF EXISTS (
    SELECT 1 FROM public.category_production_stages cps
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE cps.category_id = p_category_id
      AND ps.allows_concurrent_start = true
  ) THEN
    -- Use concurrent initialization for multi-part workflows
    RETURN public.initialize_job_stages_concurrent(p_job_id, p_job_table_name, p_category_id);
  ELSE
    -- Use standard initialization for single-part workflows
    RETURN public.initialize_job_stages(p_job_id, p_job_table_name, p_category_id);
  END IF;
END;
$$;

-- 6. Update display function to handle concurrent stages
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(
  p_user_id UUID DEFAULT auth.uid(),
  p_permission_type TEXT DEFAULT 'work',
  p_status_filter TEXT DEFAULT NULL,
  p_stage_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  job_id UUID,
  wo_no TEXT,
  customer TEXT,
  status TEXT,
  due_date TEXT,
  reference TEXT,
  category_id UUID,  
  category_name TEXT,
  category_color TEXT,
  current_stage_id UUID,
  current_stage_name TEXT,
  current_stage_color TEXT,
  current_stage_status TEXT,
  display_stage_name TEXT,
  user_can_view BOOLEAN,
  user_can_edit BOOLEAN,
  user_can_work BOOLEAN,
  user_can_manage BOOLEAN,
  workflow_progress INTEGER,
  total_stages INTEGER,
  completed_stages INTEGER,
  qty INTEGER,
  started_by UUID,
  started_by_name TEXT,
  proof_emailed_at TEXT,
  has_custom_workflow BOOLEAN,
  manual_due_date DATE,
  manual_sla_days INTEGER,
  categories JSONB,
  sla_target_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Enhanced query that handles concurrent stages and master queue consolidation
  RETURN QUERY
  WITH job_stage_counts AS (
    SELECT 
      jsi.job_id,
      COUNT(DISTINCT COALESCE(ps.master_queue_id, jsi.production_stage_id))::integer as total_stages,
      COUNT(DISTINCT CASE WHEN jsi.status = 'completed' THEN COALESCE(ps.master_queue_id, jsi.production_stage_id) END)::integer as completed_stages
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
    WHERE jsi.job_table_name = 'production_jobs'
    GROUP BY jsi.job_id
  ),
  job_current_stages AS (
    SELECT DISTINCT ON (jsi.job_id)
      jsi.job_id,
      COALESCE(mq.id, jsi.production_stage_id) as current_stage_id,
      COALESCE(mq.name, ps.name) as current_stage_name,
      COALESCE(mq.color, ps.color) as current_stage_color,
      jsi.status as current_stage_status,
      jsi.category_id,
      jsi.started_by,
      jsi.proof_emailed_at,
      -- Enhanced display name for concurrent stages
      CASE 
        WHEN jsi.concurrent_stage_group_id IS NOT NULL THEN 
          COALESCE(mq.name, ps.name) || ' (Multi-Part)'
        ELSE 
          COALESCE(mq.name, ps.name)
      END as display_stage_name
    FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
    LEFT JOIN public.production_stages mq ON ps.master_queue_id = mq.id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status IN ('active', 'pending')
    ORDER BY jsi.job_id, jsi.stage_order ASC
  )
  SELECT 
    pj.id::UUID as job_id,
    COALESCE(pj.wo_no, '')::TEXT,
    COALESCE(pj.customer, 'Unknown')::TEXT as customer,
    COALESCE(pj.status, 'Unknown')::TEXT as status,
    COALESCE(pj.due_date::TEXT, '')::TEXT as due_date,
    COALESCE(pj.reference, '')::TEXT as reference,
    COALESCE(pj.category_id, '00000000-0000-0000-0000-000000000000'::UUID)::UUID,
    COALESCE(c.name, 'No Category')::TEXT as category_name,
    COALESCE(c.color, '#6B7280')::TEXT as category_color,
    COALESCE(jcs.current_stage_id, '00000000-0000-0000-0000-000000000000'::UUID)::UUID,
    COALESCE(jcs.current_stage_name, 'No Stage')::TEXT as current_stage_name,
    COALESCE(jcs.current_stage_color, '#6B7280')::TEXT as current_stage_color,
    COALESCE(jcs.current_stage_status, 'pending')::TEXT,
    COALESCE(jcs.display_stage_name, jcs.current_stage_name, 'No Stage')::TEXT,
    true::BOOLEAN as user_can_view,
    true::BOOLEAN as user_can_edit, 
    true::BOOLEAN as user_can_work,
    true::BOOLEAN as user_can_manage,
    CASE 
      WHEN COALESCE(jsc.total_stages, 0) > 0 THEN 
        ROUND((COALESCE(jsc.completed_stages, 0)::float / jsc.total_stages::float) * 100)::integer
      ELSE 0 
    END::integer as workflow_progress,
    COALESCE(jsc.total_stages, 0)::integer as total_stages,
    COALESCE(jsc.completed_stages, 0)::integer as completed_stages,
    COALESCE(pj.qty, 0)::integer as qty,
    jcs.started_by::UUID,
    ''::TEXT as started_by_name,
    COALESCE(jcs.proof_emailed_at::TEXT, '')::TEXT as proof_emailed_at,
    COALESCE(pj.has_custom_workflow, false)::BOOLEAN,
    pj.manual_due_date::DATE,
    pj.manual_sla_days::INTEGER,
    jsonb_build_object(
      'id', c.id,
      'name', c.name, 
      'description', c.description,
      'color', c.color,
      'sla_target_days', c.sla_target_days
    ) as categories,
    COALESCE(pj.manual_sla_days, c.sla_target_days, 3)::INTEGER as sla_target_days
  FROM public.production_jobs pj
  LEFT JOIN public.categories c ON pj.category_id = c.id
  LEFT JOIN job_current_stages jcs ON pj.id = jcs.job_id
  LEFT JOIN job_stage_counts jsc ON pj.id = jsc.job_id
  WHERE (p_status_filter IS NULL OR pj.status = p_status_filter)
    AND (p_stage_filter IS NULL OR jcs.current_stage_id::TEXT = p_stage_filter)
    AND pj.status NOT IN ('Completed', 'Cancelled')
  ORDER BY pj.wo_no;
END;
$$;