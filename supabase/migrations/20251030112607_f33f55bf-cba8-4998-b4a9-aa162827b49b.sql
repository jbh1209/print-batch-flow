-- ============================================
-- NUCLEAR BACKWARD MIGRATION TO OCT 24 STATE
-- Purpose: Remove all division infrastructure added Oct 25-27
-- Target: Make Oct 27 database work with Oct 24 Lovable code
-- ============================================

-- ============================================
-- PHASE 1: DROP ALL DIVISION RLS POLICIES
-- ============================================

-- Production jobs policies
DROP POLICY IF EXISTS "Users can view jobs in their divisions" ON public.production_jobs;
DROP POLICY IF EXISTS "Users can update jobs in their divisions" ON public.production_jobs;
DROP POLICY IF EXISTS "Users can insert jobs in their divisions" ON public.production_jobs;
DROP POLICY IF EXISTS "Users can delete jobs in their divisions" ON public.production_jobs;
DROP POLICY IF EXISTS "Users can view accessible jobs" ON public.production_jobs;
DROP POLICY IF EXISTS "Users can update accessible jobs" ON public.production_jobs;
DROP POLICY IF EXISTS "Users can delete accessible jobs" ON public.production_jobs;
DROP POLICY IF EXISTS "Users can insert jobs" ON public.production_jobs;

-- Job stage instances policies
DROP POLICY IF EXISTS "Users can view stages in their divisions" ON public.job_stage_instances;
DROP POLICY IF EXISTS "Users can update stages in their divisions" ON public.job_stage_instances;
DROP POLICY IF EXISTS "Users can insert stages in their divisions" ON public.job_stage_instances;
DROP POLICY IF EXISTS "Users can delete stages in their divisions" ON public.job_stage_instances;

-- Production stages policies
DROP POLICY IF EXISTS "Users can view production stages in their divisions" ON public.production_stages;
DROP POLICY IF EXISTS "Authenticated users can view production stages" ON public.production_stages;
DROP POLICY IF EXISTS "Authenticated users can update production stages" ON public.production_stages;
DROP POLICY IF EXISTS "Authenticated users can insert production stages" ON public.production_stages;

-- Categories policies
DROP POLICY IF EXISTS "Users can view categories in their divisions" ON public.categories;
DROP POLICY IF EXISTS "Users can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update categories" ON public.categories;

-- Batches policies
DROP POLICY IF EXISTS "Users can view batches in their divisions" ON public.batches;
DROP POLICY IF EXISTS "Users can update batches in their divisions" ON public.batches;

-- Emergency policies from previous migration
DROP POLICY IF EXISTS emergency_read_all_jobs ON public.production_jobs;
DROP POLICY IF EXISTS emergency_read_all_stages ON public.job_stage_instances;
DROP POLICY IF EXISTS emergency_update_stages ON public.job_stage_instances;


-- ============================================
-- PHASE 2: CREATE SIMPLE PRE-DIVISION RLS POLICIES
-- ============================================

CREATE POLICY "authenticated_read_production_jobs" 
ON public.production_jobs 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "authenticated_insert_production_jobs"
ON public.production_jobs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_production_jobs"
ON public.production_jobs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_delete_production_jobs"
ON public.production_jobs
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "authenticated_read_job_stages"
ON public.job_stage_instances
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_job_stages"
ON public.job_stage_instances
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_job_stages"
ON public.job_stage_instances
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_delete_job_stages"
ON public.job_stage_instances
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "authenticated_read_production_stages"
ON public.production_stages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_production_stages"
ON public.production_stages
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_production_stages"
ON public.production_stages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_read_categories"
ON public.categories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert_categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update_categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_read_batches"
ON public.batches
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_update_batches"
ON public.batches
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);


-- ============================================
-- PHASE 3: DROP DIVISION-SPECIFIC FUNCTIONS
-- ============================================

DROP FUNCTION IF EXISTS public.user_can_access_division(TEXT);
DROP FUNCTION IF EXISTS public.get_user_divisions();
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_by_division(TEXT);


-- ============================================
-- PHASE 4: RESTORE PRE-DIVISION FUNCTION SIGNATURES
-- ============================================

-- Drop both possible function signatures (3-parameter and 4-parameter)
DROP FUNCTION IF EXISTS public.initialize_job_stages_auto(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.initialize_job_stages_auto(UUID, TEXT, UUID, TEXT);

-- Recreate without division parameter (3-parameter version)
CREATE FUNCTION public.initialize_job_stages_auto(
  p_job_id UUID,
  p_job_table_name TEXT,
  p_category_id UUID
)
RETURNS SETOF job_stage_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO job_stage_instances (
    job_id,
    job_table_name,
    production_stage_id,
    stage_order,
    status,
    part_assignment,
    division
  )
  SELECT 
    p_job_id,
    p_job_table_name,
    cs.production_stage_id,
    cs.stage_order,
    'pending',
    ps.part_assignment,
    'DIG'
  FROM category_stages cs
  JOIN production_stages ps ON ps.id = cs.production_stage_id
  WHERE cs.category_id = p_category_id
  ORDER BY cs.stage_order;

  RETURN QUERY 
  SELECT * 
  FROM job_stage_instances 
  WHERE job_id = p_job_id;
END;
$$;


-- ============================================
-- PHASE 5: MAKE DIVISION COLUMNS NULLABLE
-- ============================================

ALTER TABLE public.production_jobs ALTER COLUMN division DROP NOT NULL;
ALTER TABLE public.job_stage_instances ALTER COLUMN division DROP NOT NULL;
ALTER TABLE public.production_stages ALTER COLUMN division DROP NOT NULL;
ALTER TABLE public.categories ALTER COLUMN division DROP NOT NULL;
ALTER TABLE public.batches ALTER COLUMN division DROP NOT NULL;

UPDATE public.production_jobs SET division = 'DIG' WHERE division IS NULL;
UPDATE public.job_stage_instances SET division = 'DIG' WHERE division IS NULL;
UPDATE public.production_stages SET division = 'DIG' WHERE division IS NULL;
UPDATE public.categories SET division = 'DIG' WHERE division IS NULL;
UPDATE public.batches SET division = 'DIG' WHERE division IS NULL;


-- ============================================
-- PHASE 6: FIX DEPENDENCY GROUPS (CRITICAL)
-- ============================================

WITH jobs_needing_groups AS (
  SELECT DISTINCT job_id, gen_random_uuid() AS new_group
  FROM job_stage_instances
  WHERE job_table_name = 'production_jobs'
    AND part_assignment IN ('cover', 'text', 'both')
),
merge_points AS (
  SELECT 
    job_id, 
    MIN(stage_order) AS merge_order
  FROM job_stage_instances
  WHERE job_table_name = 'production_jobs'
    AND part_assignment = 'both'
  GROUP BY job_id
)
UPDATE job_stage_instances jsi
SET dependency_group = jng.new_group
FROM jobs_needing_groups jng
JOIN merge_points mp ON mp.job_id = jng.job_id
WHERE jsi.job_id = jng.job_id
  AND jsi.job_table_name = 'production_jobs'
  AND (
    (jsi.part_assignment IN ('cover', 'text') AND jsi.stage_order < mp.merge_order)
    OR (jsi.part_assignment = 'both' AND jsi.stage_order >= mp.merge_order)
  );