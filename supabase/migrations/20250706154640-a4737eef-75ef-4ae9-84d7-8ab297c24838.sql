-- Comprehensive Multi-Stage Concurrent Workflow Fix (Corrected)

-- 1. Fix the advance_job_stage function SQL ambiguity error
CREATE OR REPLACE FUNCTION public.advance_job_stage(
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
  next_concurrent_group_id UUID;
  is_expedited BOOLEAN := false;
BEGIN
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

  -- Check if job is expedited (fix SQL ambiguity with proper table alias)
  IF p_job_table_name = 'production_jobs' THEN
    SELECT pj.is_expedited INTO is_expedited
    FROM public.production_jobs pj
    WHERE pj.id = p_job_id;
  END IF;

  -- Find next concurrent group
  SELECT DISTINCT jsi.concurrent_stage_group_id INTO next_concurrent_group_id
  FROM public.job_stage_instances jsi
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.status = 'pending'
    AND jsi.stage_order = (
      SELECT MIN(jsi2.stage_order)
      FROM public.job_stage_instances jsi2
      WHERE jsi2.job_id = p_job_id 
        AND jsi2.job_table_name = p_job_table_name
        AND jsi2.status = 'pending'
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
        SELECT MIN(jsi3.stage_order)
        FROM public.job_stage_instances jsi3
        WHERE jsi3.job_id = p_job_id 
          AND jsi3.job_table_name = p_job_table_name
          AND jsi3.status = 'pending'
      );
  END IF;

  RETURN TRUE;
END;
$$;

-- 2. Fix stage orders for concurrent printing stages (they must have the same stage_order)
UPDATE public.production_stages 
SET order_index = 400
WHERE name ILIKE '%printing%' 
  AND name NOT ILIKE '%queue%'
  AND name NOT ILIKE '%laminating%';

-- 3. Update job_stage_instances to have correct stage_order for printing stages
UPDATE public.job_stage_instances 
SET stage_order = 400
FROM public.production_stages ps
WHERE job_stage_instances.production_stage_id = ps.id
  AND ps.name ILIKE '%printing%' 
  AND ps.name NOT ILIKE '%queue%'
  AND ps.name NOT ILIKE '%laminating%';

-- 4. Create proper concurrent groups for all printing stages of each job
WITH job_concurrent_groups AS (
  SELECT 
    jsi.job_id,
    jsi.job_table_name,
    gen_random_uuid() as new_concurrent_group_id
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE ps.name ILIKE '%printing%' 
    AND ps.name NOT ILIKE '%queue%'
    AND ps.name NOT ILIKE '%laminating%'
  GROUP BY jsi.job_id, jsi.job_table_name
)
UPDATE public.job_stage_instances
SET 
  concurrent_stage_group_id = jcg.new_concurrent_group_id,
  allows_concurrent_start = true,
  part_name = CASE 
    WHEN ps.name ILIKE '%hp 12000%' OR ps.name ILIKE '%cover%' THEN 'covers'
    WHEN ps.name ILIKE '%hp t250%' OR ps.name ILIKE '%text%' THEN 'text'
    ELSE 'covers'
  END,
  updated_at = now()
FROM job_concurrent_groups jcg,
     public.production_stages ps
WHERE job_stage_instances.job_id = jcg.job_id
  AND job_stage_instances.job_table_name = jcg.job_table_name
  AND job_stage_instances.production_stage_id = ps.id
  AND ps.name ILIKE '%printing%' 
  AND ps.name NOT ILIKE '%queue%'
  AND ps.name NOT ILIKE '%laminating%';

-- 5. Ensure Laminating Queue master stage exists and is properly configured
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
  500, 
  'Master queue for all laminating operations', 
  true,
  false,
  false
) ON CONFLICT (name) DO UPDATE SET
  order_index = 500,
  is_active = true;

-- 6. Set all laminating stages to use the master queue
UPDATE public.production_stages 
SET master_queue_id = (
  SELECT id FROM public.production_stages 
  WHERE name = 'Laminating Queue' 
  LIMIT 1
)
WHERE name ILIKE '%laminating%' 
  AND name != 'Laminating Queue';

-- 7. Fix any jobs that are currently stuck - activate concurrent printing stages
UPDATE public.job_stage_instances
SET 
  status = 'active',
  started_at = now(),
  started_by = (SELECT auth.uid()),
  updated_at = now()
WHERE id IN (
  SELECT jsi.id
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE ps.name ILIKE '%printing%' 
    AND ps.name NOT ILIKE '%queue%'
    AND ps.name NOT ILIKE '%laminating%'
    AND jsi.status = 'pending'
    AND jsi.concurrent_stage_group_id IS NOT NULL
    AND EXISTS (
      -- Only activate if previous stages are completed
      SELECT 1 FROM public.job_stage_instances jsi_prev
      JOIN public.production_stages ps_prev ON jsi_prev.production_stage_id = ps_prev.id
      WHERE jsi_prev.job_id = jsi.job_id
        AND jsi_prev.job_table_name = jsi.job_table_name
        AND jsi_prev.stage_order < jsi.stage_order
        AND jsi_prev.status = 'completed'
        AND (ps_prev.name ILIKE '%dtp%' OR ps_prev.name ILIKE '%proof%')
    )
);