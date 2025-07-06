-- Fix concurrent workflow issues - corrected approach

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

-- 3. Update existing printing stage instances to enable concurrent operation
-- Group printing stages by job and assign the same concurrent group ID
WITH job_printing_groups AS (
  SELECT 
    jsi.job_id,
    jsi.job_table_name,
    gen_random_uuid() as concurrent_group_id
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE ps.name ILIKE '%printing%' 
    AND ps.name NOT ILIKE '%queue%'
    AND ps.name NOT ILIKE '%laminating%'
    AND jsi.concurrent_stage_group_id IS NULL
  GROUP BY jsi.job_id, jsi.job_table_name
)
UPDATE public.job_stage_instances
SET 
  concurrent_stage_group_id = jpg.concurrent_group_id,
  allows_concurrent_start = true,
  part_name = CASE 
    WHEN ps.name ILIKE '%hp 12000%' THEN 'covers'
    WHEN ps.name ILIKE '%hp t250%' THEN 'text'
    ELSE 'covers'
  END,
  updated_at = now()
FROM job_printing_groups jpg
JOIN public.production_stages ps ON job_stage_instances.production_stage_id = ps.id
WHERE job_stage_instances.job_id = jpg.job_id
  AND job_stage_instances.job_table_name = jpg.job_table_name
  AND ps.name ILIKE '%printing%' 
  AND ps.name NOT ILIKE '%queue%'
  AND ps.name NOT ILIKE '%laminating%';

-- 4. Update the standard advance function to use the enhanced logic
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

  -- Check if job is expedited
  IF p_job_table_name = 'production_jobs' THEN
    SELECT is_expedited INTO is_expedited
    FROM public.production_jobs
    WHERE id = p_job_id;
  END IF;

  -- Find next concurrent group or single stage
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

-- 5. Activate both printing stages for job D425455 specifically
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