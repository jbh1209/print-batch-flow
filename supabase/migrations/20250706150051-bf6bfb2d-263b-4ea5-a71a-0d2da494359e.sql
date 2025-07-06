-- Fix multi-part concurrent workflow issues

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
  AND name NOT ILIKE '%queue%';

-- 3. Update finishing stages to require all parts complete
UPDATE public.production_stages 
SET requires_all_parts_complete = true
WHERE name ILIKE ANY(ARRAY['%finishing%', '%gathering%', '%binding%', '%cutting%', '%folding%']);

-- 4. Fix existing jobs that should have concurrent printing stages
DO $$
DECLARE
  job_record RECORD;
  printing_stage_id UUID;
  concurrent_group_id UUID;
BEGIN
  -- Find jobs that have multi-part printing categories but no concurrent groups
  FOR job_record IN
    SELECT DISTINCT pj.id as job_id, pj.wo_no, pj.category_id
    FROM public.production_jobs pj
    JOIN public.categories c ON pj.category_id = c.id
    JOIN public.category_production_stages cps ON c.id = cps.category_id
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE ps.name ILIKE '%printing%'
      AND ps.allows_concurrent_start = true
      AND pj.status NOT IN ('Completed', 'Cancelled')
      -- Only jobs that don't already have concurrent groups
      AND NOT EXISTS (
        SELECT 1 FROM public.job_stage_instances jsi 
        WHERE jsi.job_id = pj.id 
          AND jsi.concurrent_stage_group_id IS NOT NULL
      )
  LOOP
    -- Create concurrent group for this job's printing stages
    concurrent_group_id := gen_random_uuid();
    
    -- Find printing stages for this job and make them concurrent
    FOR printing_stage_id IN
      SELECT jsi.production_stage_id
      FROM public.job_stage_instances jsi
      JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
      WHERE jsi.job_id = job_record.job_id
        AND jsi.job_table_name = 'production_jobs'
        AND ps.name ILIKE '%printing%'
        AND ps.allows_concurrent_start = true
    LOOP
      -- Update existing printing stages to be concurrent
      UPDATE public.job_stage_instances
      SET 
        concurrent_stage_group_id = concurrent_group_id,
        allows_concurrent_start = true,
        part_name = CASE 
          WHEN part_name IS NULL THEN 'covers'
          ELSE part_name 
        END,
        updated_at = now()
      WHERE job_id = job_record.job_id
        AND job_table_name = 'production_jobs'
        AND production_stage_id = printing_stage_id;
      
      -- Create duplicate for text part if not exists
      IF NOT EXISTS (
        SELECT 1 FROM public.job_stage_instances
        WHERE job_id = job_record.job_id
          AND production_stage_id = printing_stage_id
          AND part_name = 'text'
      ) THEN
        INSERT INTO public.job_stage_instances (
          job_id, job_table_name, category_id, production_stage_id,
          stage_order, status, part_name, concurrent_stage_group_id,
          allows_concurrent_start
        )
        SELECT 
          job_id, job_table_name, category_id, production_stage_id,
          stage_order, status, 'text', concurrent_group_id, true
        FROM public.job_stage_instances
        WHERE job_id = job_record.job_id
          AND production_stage_id = printing_stage_id
          AND part_name = 'covers'
        LIMIT 1;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Fixed concurrent printing for job %', job_record.wo_no;
  END LOOP;
END $$;

-- 5. Create function to initialize jobs with proper concurrent workflow
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
  -- Use the new concurrent initialization for multi-part categories
  IF EXISTS (
    SELECT 1 FROM public.category_production_stages cps
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE cps.category_id = p_category_id
      AND ps.allows_concurrent_start = true
  ) THEN
    -- Use concurrent initialization
    RETURN public.initialize_job_stages_concurrent(p_job_id, p_job_table_name, p_category_id);
  ELSE
    -- Use standard initialization for single-part workflows
    RETURN public.initialize_job_stages(p_job_id, p_job_table_name, p_category_id);
  END IF;
END;
$$;