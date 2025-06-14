
-- Drop the existing function to avoid signature conflicts.
-- The explicit parameter types are needed to distinguish it from other functions with the same name.
DROP FUNCTION IF EXISTS public.initialize_job_stages_with_part_assignments(uuid, text, uuid, jsonb);

-- Recreate the function with the new, simpler, and more robust logic.
CREATE FUNCTION public.initialize_job_stages_with_part_assignments(
  p_job_id uuid,
  p_job_table_name text,
  p_category_id uuid,
  p_part_assignments jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  stage_record RECORD;
  part_name TEXT;
  assigned_stage_id UUID;
  v_stage_order INTEGER; -- Variable to hold the stage order for part-specific stages
BEGIN
  -- Validate core inputs
  IF p_job_id IS NULL OR p_job_table_name IS NULL OR p_category_id IS NULL THEN
    RAISE EXCEPTION 'job_id, job_table_name, and category_id must be provided.';
  END IF;

  -- The calling function (useAtomicCategoryAssignment) is responsible for clearing existing stages.
  -- This function's only job is to create the new, correct set of stages.

  -- STEP 1: Create instances for all standard (non-multi-part) stages for the category.
  FOR stage_record IN
    SELECT
      cps.production_stage_id,
      cps.stage_order
    FROM public.category_production_stages cps
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE cps.category_id = p_category_id
      AND ps.is_multi_part = false
    ORDER BY cps.stage_order
  LOOP
    INSERT INTO public.job_stage_instances (
      job_id, job_table_name, category_id, production_stage_id, stage_order, status
    ) VALUES (
      p_job_id, p_job_table_name, p_category_id, stage_record.production_stage_id, stage_record.stage_order, 'pending'
    );
  END LOOP;

  -- STEP 2: Create instances for all explicitly assigned multi-part stages from the UI.
  IF p_part_assignments IS NOT NULL AND jsonb_typeof(p_part_assignments) = 'object' THEN
    FOR part_name, assigned_stage_id IN
      SELECT key, value::uuid FROM jsonb_each_text(p_part_assignments)
    LOOP
      -- Get stage order from category definition to ensure consistent ordering
      SELECT cps.stage_order INTO v_stage_order
      FROM public.category_production_stages cps
      WHERE cps.category_id = p_category_id
        AND cps.production_stage_id = assigned_stage_id;

      IF NOT FOUND THEN
        -- This provides a clear error if the UI tries to assign a stage not in the category's workflow
        RAISE EXCEPTION 'Assigned stage ID % for part "%" is not valid for category %.', assigned_stage_id, part_name, p_category_id;
      END IF;

      INSERT INTO public.job_stage_instances (
        job_id, job_table_name, category_id, production_stage_id, stage_order, part_name, status
      ) VALUES (
        p_job_id, p_job_table_name, p_category_id, assigned_stage_id, v_stage_order, part_name, 'pending'
      );
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$function$;
