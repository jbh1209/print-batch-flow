-- Fix concurrent workflow issues for job D425455 and other jobs

-- 1. Create the missing "Laminating Queue" master stage
INSERT INTO public.production_stages (
  name, 
  color, 
  order_index, 
  description, 
  is_active,
  is_multi_part,
  allows_concurrent_start
) VALUES (
  'Laminating Queue', 
  '#F59E0B', 
  800, 
  'Master queue for all laminating operations', 
  true,
  false,
  false
) ON CONFLICT (name) DO NOTHING;

-- 2. Set "Laminating - Cover" to use "Laminating Queue" as master
UPDATE public.production_stages 
SET master_queue_id = (
  SELECT id FROM public.production_stages 
  WHERE name = 'Laminating Queue' 
  LIMIT 1
)
WHERE name = 'Laminating - Cover';

-- 3. Fix existing jobs with missing concurrent printing parts
WITH printing_stages AS (
  SELECT id, name FROM public.production_stages 
  WHERE name ILIKE '%printing%' 
    AND name NOT ILIKE '%queue%'
    AND name NOT ILIKE '%laminating%'
    AND is_multi_part = true
),
jobs_needing_text_parts AS (
  SELECT DISTINCT 
    jsi.job_id,
    jsi.job_table_name,
    jsi.category_id,
    ps.id as stage_id,
    jsi.stage_order,
    jsi.concurrent_stage_group_id
  FROM public.job_stage_instances jsi
  JOIN printing_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.part_name = 'covers'
    AND NOT EXISTS (
      SELECT 1 FROM public.job_stage_instances jsi2
      WHERE jsi2.job_id = jsi.job_id
        AND jsi2.production_stage_id = jsi.production_stage_id
        AND jsi2.part_name = 'text'
    )
)
INSERT INTO public.job_stage_instances (
  job_id,
  job_table_name,
  category_id,
  production_stage_id,
  stage_order,
  part_name,
  status,
  concurrent_stage_group_id,
  allows_concurrent_start
)
SELECT 
  job_id,
  job_table_name,
  category_id,
  stage_id,
  stage_order,
  'text',
  'pending',
  concurrent_stage_group_id,
  true
FROM jobs_needing_text_parts;

-- 4. Ensure all printing stages in the same job share concurrent group IDs
UPDATE public.job_stage_instances
SET concurrent_stage_group_id = subq.group_id
FROM (
  SELECT 
    job_id,
    production_stage_id,
    COALESCE(
      MIN(concurrent_stage_group_id) FILTER (WHERE concurrent_stage_group_id IS NOT NULL),
      gen_random_uuid()
    ) as group_id
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE ps.name ILIKE '%printing%' 
    AND ps.name NOT ILIKE '%queue%'
    AND ps.name NOT ILIKE '%laminating%'
  GROUP BY job_id, production_stage_id
) subq
WHERE job_stage_instances.job_id = subq.job_id
  AND job_stage_instances.production_stage_id = subq.production_stage_id;

-- 5. Update the stage advancement function to handle concurrent activation
CREATE OR REPLACE FUNCTION public.advance_job_stage_enhanced(
  p_job_id UUID,
  p_job_table_name TEXT,
  p_current_stage_id UUID,
  p_completed_by UUID DEFAULT auth.uid(),
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stage_order INTEGER;
  next_concurrent_group_id UUID;
  is_expedited BOOLEAN := false;
BEGIN
  -- Get current stage order
  SELECT stage_order INTO current_stage_order
  FROM public.job_stage_instances
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND production_stage_id = p_current_stage_id
    AND status = 'active'
  LIMIT 1;

  -- Complete current stage
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = p_completed_by,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE job_id = p_job_id 
    AND job_table_name = p_job_table_name
    AND production_stage_id = p_current_stage_id
    AND status = 'active';

  -- Check if job is expedited
  IF p_job_table_name = 'production_jobs' THEN
    SELECT is_expedited INTO is_expedited
    FROM public.production_jobs
    WHERE id = p_job_id;
  END IF;

  -- Find next stage(s) to activate
  -- Check if next stage is part of a concurrent group
  SELECT DISTINCT concurrent_stage_group_id INTO next_concurrent_group_id
  FROM public.job_stage_instances jsi
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.status = 'pending'
    AND jsi.stage_order = (
      SELECT MIN(stage_order)
      FROM public.job_stage_instances
      WHERE job_id = p_job_id 
        AND job_table_name = p_job_table_name
        AND status = 'pending'
    )
    AND jsi.concurrent_stage_group_id IS NOT NULL;

  IF next_concurrent_group_id IS NOT NULL THEN
    -- Activate all stages in the concurrent group
    UPDATE public.job_stage_instances
    SET 
      status = 'active',
      started_at = now(),
      started_by = p_completed_by,
      job_order_in_stage = CASE WHEN is_expedited THEN 0 ELSE 1 END,
      updated_at = now()
    WHERE job_id = p_job_id 
      AND job_table_name = p_job_table_name
      AND concurrent_stage_group_id = next_concurrent_group_id
      AND status = 'pending';
  ELSE
    -- Activate next single stage
    UPDATE public.job_stage_instances
    SET 
      status = 'active',
      started_at = now(),
      started_by = p_completed_by,
      job_order_in_stage = CASE WHEN is_expedited THEN 0 ELSE 1 END,
      updated_at = now()
    WHERE job_id = p_job_id 
      AND job_table_name = p_job_table_name
      AND status = 'pending'
      AND stage_order = (
        SELECT MIN(stage_order)
        FROM public.job_stage_instances
        WHERE job_id = p_job_id 
          AND job_table_name = p_job_table_name
          AND status = 'pending'
      );
  END IF;

  RETURN TRUE;
END;
$$;

-- 6. For job D425455 specifically, activate both printing stages
UPDATE public.job_stage_instances
SET 
  status = 'active',
  started_at = now(),
  started_by = (SELECT auth.uid()),
  updated_at = now()
WHERE job_id IN (
  SELECT id FROM public.production_jobs WHERE wo_no = 'D425455'
)
AND job_table_name = 'production_jobs'
AND production_stage_id IN (
  SELECT id FROM public.production_stages 
  WHERE name ILIKE '%printing%' 
    AND name NOT ILIKE '%queue%'
    AND name NOT ILIKE '%laminating%'
)
AND status = 'pending';