-- Clean up corrupted category stage data and create safe reordering function

-- Step 1: Fix all negative stage orders and ensure sequential ordering
DO $$
DECLARE
  cat_record RECORD;
  stage_record RECORD;
  new_order INTEGER;
BEGIN
  -- Loop through each category
  FOR cat_record IN 
    SELECT DISTINCT category_id 
    FROM public.category_production_stages 
    WHERE stage_order < 1 OR category_id IN (
      SELECT category_id 
      FROM public.category_production_stages 
      GROUP BY category_id 
      HAVING array_agg(stage_order ORDER BY stage_order) != array_agg(row_number() OVER (ORDER BY stage_order))
    )
  LOOP
    new_order := 1;
    
    -- Re-sequence all stages for this category
    FOR stage_record IN 
      SELECT id 
      FROM public.category_production_stages 
      WHERE category_id = cat_record.category_id 
      ORDER BY 
        CASE WHEN stage_order < 1 THEN 9999 ELSE stage_order END,
        created_at
    LOOP
      UPDATE public.category_production_stages 
      SET stage_order = new_order, updated_at = now() 
      WHERE id = stage_record.id;
      
      new_order := new_order + 1;
    END LOOP;
    
    RAISE NOTICE 'Fixed stage ordering for category %', cat_record.category_id;
  END LOOP;
END $$;

-- Step 2: Create safe atomic reordering function
CREATE OR REPLACE FUNCTION public.reorder_category_stages_safe(
  p_category_id uuid,
  p_stage_reorders jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_update RECORD;
  temp_offset INTEGER := 10000;
  result_count INTEGER := 0;
  error_message TEXT := '';
BEGIN
  -- Validate input
  IF p_category_id IS NULL OR p_stage_reorders IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid parameters: category_id and stage_reorders required'
    );
  END IF;

  BEGIN
    -- Step 1: Move all stages to temporary high numbers to avoid conflicts
    UPDATE public.category_production_stages 
    SET 
      stage_order = stage_order + temp_offset,
      updated_at = now()
    WHERE category_id = p_category_id;

    -- Step 2: Update to final positions from the reorder data
    FOR stage_update IN 
      SELECT 
        (value->>'id')::uuid as stage_id,
        (value->>'stage_order')::integer as new_order
      FROM jsonb_array_elements(p_stage_reorders)
    LOOP
      UPDATE public.category_production_stages
      SET 
        stage_order = stage_update.new_order,
        updated_at = now()
      WHERE id = stage_update.stage_id 
        AND category_id = p_category_id;
        
      GET DIAGNOSTICS result_count = ROW_COUNT;
      
      IF result_count = 0 THEN
        RAISE EXCEPTION 'Stage with id % not found in category %', stage_update.stage_id, p_category_id;
      END IF;
    END LOOP;

    -- Step 3: Verify sequential ordering and fix any gaps
    WITH ordered_stages AS (
      SELECT 
        id, 
        ROW_NUMBER() OVER (ORDER BY stage_order) as correct_order
      FROM public.category_production_stages 
      WHERE category_id = p_category_id
    )
    UPDATE public.category_production_stages 
    SET 
      stage_order = ordered_stages.correct_order,
      updated_at = now()
    FROM ordered_stages 
    WHERE category_production_stages.id = ordered_stages.id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Category stages reordered successfully'
    );

  EXCEPTION WHEN OTHERS THEN
    error_message := SQLERRM;
    
    -- Rollback: restore original sequential order
    WITH ordered_stages AS (
      SELECT 
        id, 
        ROW_NUMBER() OVER (ORDER BY created_at) as restore_order
      FROM public.category_production_stages 
      WHERE category_id = p_category_id
    )
    UPDATE public.category_production_stages 
    SET 
      stage_order = ordered_stages.restore_order,
      updated_at = now()
    FROM ordered_stages 
    WHERE category_production_stages.id = ordered_stages.id;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Reordering failed: %s. Restored original order.', error_message)
    );
  END;
END;
$$;

-- Step 3: Create enhanced fix ordering function
CREATE OR REPLACE FUNCTION public.fix_category_stage_ordering(p_category_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_record RECORD;
  new_order INTEGER := 1;
  fixed_count INTEGER := 0;
BEGIN
  -- Re-sequence all stages for the category to ensure proper order
  FOR stage_record IN 
    SELECT id 
    FROM public.category_production_stages 
    WHERE category_id = p_category_id 
    ORDER BY 
      CASE WHEN stage_order < 1 THEN 9999 ELSE stage_order END,
      created_at
  LOOP
    UPDATE public.category_production_stages 
    SET 
      stage_order = new_order, 
      updated_at = now() 
    WHERE id = stage_record.id;
    
    new_order := new_order + 1;
    fixed_count := fixed_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'fixed_count', fixed_count,
    'message', format('Fixed ordering for %s stages', fixed_count)
  );
END;
$$;