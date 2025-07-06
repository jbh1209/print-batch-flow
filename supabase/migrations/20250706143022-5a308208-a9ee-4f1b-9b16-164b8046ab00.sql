-- Multi-Part Concurrent Workflow System Implementation

-- Add new columns to job_stage_instances for concurrent workflow management
ALTER TABLE public.job_stage_instances 
ADD COLUMN IF NOT EXISTS stage_dependency_group UUID,
ADD COLUMN IF NOT EXISTS allows_concurrent_start BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS part_flow_chain TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS requires_all_parts_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS concurrent_stage_group_id UUID;

-- Add new columns to production_stages for workflow rules
ALTER TABLE public.production_stages
ADD COLUMN IF NOT EXISTS allows_concurrent_start BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_all_parts_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS part_specific_stages TEXT[] DEFAULT '{}';

-- Create function to start concurrent stages for multi-part jobs
CREATE OR REPLACE FUNCTION public.start_concurrent_printing_stages(
  p_job_id UUID,
  p_job_table_name TEXT,
  p_stage_ids UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_id UUID;
  group_id UUID := gen_random_uuid();
BEGIN
  -- Create a concurrent group for this job's printing stages
  FOREACH stage_id IN ARRAY p_stage_ids
  LOOP
    UPDATE public.job_stage_instances
    SET 
      status = 'active',
      started_at = now(),
      started_by = auth.uid(),
      concurrent_stage_group_id = group_id,
      allows_concurrent_start = true,
      updated_at = now()
    WHERE job_id = p_job_id 
      AND job_table_name = p_job_table_name
      AND production_stage_id = stage_id
      AND status = 'pending';
  END LOOP;

  RETURN TRUE;
END;
$$;

-- Create function to check if all parts in a dependency group are complete
CREATE OR REPLACE FUNCTION public.check_dependency_completion(
  p_job_id UUID,
  p_job_table_name TEXT,
  p_dependency_group UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  incomplete_count INTEGER;
BEGIN
  -- Count incomplete stages in the dependency group
  SELECT COUNT(*) INTO incomplete_count
  FROM public.job_stage_instances
  WHERE job_id = p_job_id
    AND job_table_name = p_job_table_name
    AND stage_dependency_group = p_dependency_group
    AND status NOT IN ('completed', 'skipped');
    
  RETURN incomplete_count = 0;
END;
$$;

-- Enhanced advance_job_stage function to handle part-specific chains
CREATE OR REPLACE FUNCTION public.advance_job_stage_with_parts(
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
  current_stage RECORD;
  next_part_stage_id UUID;
  dependency_group UUID;
  finishing_stages_ready BOOLEAN := false;
BEGIN
  -- Get current stage info
  SELECT * INTO current_stage
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.production_stage_id = p_current_stage_id;

  -- Complete the current stage
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

  -- Check if this is a part-specific chain (e.g., covers going to laminating)
  IF current_stage.part_name = 'covers' AND EXISTS (
    SELECT 1 FROM public.job_stage_instances jsi2
    JOIN public.production_stages ps2 ON jsi2.production_stage_id = ps2.id
    WHERE jsi2.job_id = p_job_id 
      AND jsi2.job_table_name = p_job_table_name
      AND ps2.name ILIKE '%laminating%'
      AND jsi2.part_name = 'covers'
      AND jsi2.status = 'pending'
  ) THEN
    -- Activate laminating stage for covers
    UPDATE public.job_stage_instances
    SET 
      status = 'active',
      started_at = now(),
      started_by = p_completed_by,
      updated_at = now()
    WHERE job_id = p_job_id 
      AND job_table_name = p_job_table_name
      AND production_stage_id IN (
        SELECT ps.id FROM public.production_stages ps 
        WHERE ps.name ILIKE '%laminating%'
      )
      AND part_name = 'covers'
      AND status = 'pending';
  END IF;

  -- Check if all printing and part-specific processing is complete for finishing stages
  IF NOT EXISTS (
    SELECT 1 FROM public.job_stage_instances jsi
    JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
    WHERE jsi.job_id = p_job_id 
      AND jsi.job_table_name = p_job_table_name
      AND (ps.name ILIKE '%printing%' OR ps.name ILIKE '%laminating%')
      AND jsi.status NOT IN ('completed', 'skipped')
  ) THEN
    -- All printing and laminating complete, enable finishing stages
    UPDATE public.job_stage_instances
    SET 
      status = 'pending',
      updated_at = now()
    WHERE job_id = p_job_id 
      AND job_table_name = p_job_table_name
      AND production_stage_id IN (
        SELECT ps.id FROM public.production_stages ps 
        WHERE ps.name ILIKE ANY(ARRAY['%finishing%', '%gathering%', '%binding%', '%cutting%'])
      )
      AND status = 'blocked';
  END IF;

  RETURN TRUE;
END;
$$;

-- Create function to initialize multi-part job stages with concurrent setup
CREATE OR REPLACE FUNCTION public.initialize_job_stages_concurrent(
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
  printing_group_id UUID := gen_random_uuid();
  dependency_group_id UUID := gen_random_uuid();
  part_name TEXT;
  is_first_stage BOOLEAN := true;
BEGIN
  -- Create stage instances for each stage in the category
  FOR stage_record IN
    SELECT 
      cps.production_stage_id,
      cps.stage_order,
      ps.name as stage_name,
      ps.is_multi_part,
      ps.part_definitions
    FROM public.category_production_stages cps
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE cps.category_id = p_category_id
    ORDER BY cps.stage_order ASC
  LOOP
    -- Handle multi-part printing stages
    IF stage_record.is_multi_part AND stage_record.stage_name ILIKE '%printing%' THEN
      FOR part_name IN SELECT jsonb_array_elements_text(stage_record.part_definitions)
      LOOP
        INSERT INTO public.job_stage_instances (
          job_id,
          job_table_name,
          category_id,
          production_stage_id,
          stage_order,
          part_name,
          status,
          allows_concurrent_start,
          concurrent_stage_group_id,
          stage_dependency_group
        ) VALUES (
          p_job_id,
          p_job_table_name,
          p_category_id,
          stage_record.production_stage_id,
          stage_record.stage_order,
          part_name,
          'pending',
          true,
          printing_group_id,
          dependency_group_id
        );
      END LOOP;
    
    -- Handle part-specific stages like laminating (only for covers)
    ELSIF stage_record.stage_name ILIKE '%laminating%' THEN
      INSERT INTO public.job_stage_instances (
        job_id,
        job_table_name,
        category_id,
        production_stage_id,
        stage_order,
        part_name,
        status,
        stage_dependency_group
      ) VALUES (
        p_job_id,
        p_job_table_name,
        p_category_id,
        stage_record.production_stage_id,
        stage_record.stage_order,
        'covers',
        'pending',
        dependency_group_id
      );
    
    -- Handle finishing stages that need all parts complete
    ELSIF stage_record.stage_name ILIKE ANY(ARRAY['%finishing%', '%gathering%', '%binding%', '%cutting%']) THEN
      INSERT INTO public.job_stage_instances (
        job_id,
        job_table_name,
        category_id,
        production_stage_id,
        stage_order,
        status,
        requires_all_parts_complete
      ) VALUES (
        p_job_id,
        p_job_table_name,
        p_category_id,
        stage_record.production_stage_id,
        stage_record.stage_order,
        'blocked', -- Blocked until all parts complete
        true
      );
    
    -- Handle regular single-part stages
    ELSE
      INSERT INTO public.job_stage_instances (
        job_id,
        job_table_name,
        category_id,
        production_stage_id,
        stage_order,
        status
      ) VALUES (
        p_job_id,
        p_job_table_name,
        p_category_id,
        stage_record.production_stage_id,
        stage_record.stage_order,
        CASE WHEN is_first_stage THEN 'pending' ELSE 'pending' END
      );
    END IF;
    
    is_first_stage := false;
  END LOOP;
  
  RETURN TRUE;
END;
$$;

-- Update production_stages for common workflow stages
UPDATE public.production_stages 
SET allows_concurrent_start = true
WHERE name ILIKE '%printing%';

UPDATE public.production_stages 
SET requires_all_parts_complete = true,
    part_specific_stages = ARRAY['covers', 'text']
WHERE name ILIKE ANY(ARRAY['%finishing%', '%gathering%', '%binding%', '%cutting%']);

-- Add index for performance on new columns
CREATE INDEX IF NOT EXISTS idx_job_stage_instances_concurrent_group 
ON public.job_stage_instances(concurrent_stage_group_id);

CREATE INDEX IF NOT EXISTS idx_job_stage_instances_dependency_group 
ON public.job_stage_instances(stage_dependency_group);