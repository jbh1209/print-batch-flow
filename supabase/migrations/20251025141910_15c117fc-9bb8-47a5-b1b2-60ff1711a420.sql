-- Phase 2: Update RPC Functions to Accept Division Parameter
-- This migration updates all critical workflow RPC functions to accept and use the division parameter

-- 1. Update initialize_job_stages_auto (most commonly used)
CREATE OR REPLACE FUNCTION initialize_job_stages_auto(
  p_job_id UUID,
  p_job_table_name TEXT,
  p_category_id UUID,
  p_division TEXT DEFAULT 'DIG'
)
RETURNS SETOF job_stage_instances AS $$
BEGIN
  INSERT INTO job_stage_instances (
    job_id,
    job_table_name,
    production_stage_id,
    category_id,
    stage_order,
    status,
    division
  )
  SELECT
    p_job_id,
    p_job_table_name,
    cps.production_stage_id,
    p_category_id,
    cps.stage_order,
    'pending',
    p_division
  FROM category_production_stages cps
  WHERE cps.category_id = p_category_id
  ORDER BY cps.stage_order;
  
  RETURN QUERY
  SELECT * FROM job_stage_instances
  WHERE job_id = p_job_id AND job_table_name = p_job_table_name;
END;
$$ LANGUAGE plpgsql;

-- 2. Update initialize_job_stages (for part-assignment workflows)
CREATE OR REPLACE FUNCTION initialize_job_stages(
  p_job_id UUID,
  p_job_table_name TEXT,
  p_category_id UUID,
  p_division TEXT DEFAULT 'DIG'
)
RETURNS SETOF job_stage_instances AS $$
BEGIN
  INSERT INTO job_stage_instances (
    job_id,
    job_table_name,
    production_stage_id,
    category_id,
    stage_order,
    status,
    division
  )
  SELECT
    p_job_id,
    p_job_table_name,
    cps.production_stage_id,
    p_category_id,
    cps.stage_order,
    'pending',
    p_division
  FROM category_production_stages cps
  WHERE cps.category_id = p_category_id
  ORDER BY cps.stage_order;
  
  RETURN QUERY
  SELECT * FROM job_stage_instances
  WHERE job_id = p_job_id AND job_table_name = p_job_table_name;
END;
$$ LANGUAGE plpgsql;

-- 3. Update initialize_job_stages_with_multi_specs (for multi-spec workflows)
CREATE OR REPLACE FUNCTION initialize_job_stages_with_multi_specs(
  p_job_id UUID,
  p_job_table_name TEXT,
  p_category_id UUID,
  p_division TEXT DEFAULT 'DIG'
)
RETURNS SETOF job_stage_instances AS $$
BEGIN
  INSERT INTO job_stage_instances (
    job_id,
    job_table_name,
    production_stage_id,
    category_id,
    stage_order,
    status,
    division
  )
  SELECT
    p_job_id,
    p_job_table_name,
    cps.production_stage_id,
    p_category_id,
    cps.stage_order,
    'pending',
    p_division
  FROM category_production_stages cps
  WHERE cps.category_id = p_category_id
  ORDER BY cps.stage_order;
  
  RETURN QUERY
  SELECT * FROM job_stage_instances
  WHERE job_id = p_job_id AND job_table_name = p_job_table_name;
END;
$$ LANGUAGE plpgsql;

-- 4. Update initialize_custom_job_stages (for custom workflows)
CREATE OR REPLACE FUNCTION initialize_custom_job_stages(
  p_job_id UUID,
  p_job_table_name TEXT,
  p_stage_ids UUID[],
  p_category_id UUID,
  p_division TEXT DEFAULT 'DIG'
)
RETURNS SETOF job_stage_instances AS $$
DECLARE
  v_stage_id UUID;
  v_order INT := 0;
BEGIN
  FOREACH v_stage_id IN ARRAY p_stage_ids
  LOOP
    v_order := v_order + 1;
    INSERT INTO job_stage_instances (
      job_id,
      job_table_name,
      production_stage_id,
      category_id,
      stage_order,
      status,
      division
    )
    VALUES (
      p_job_id,
      p_job_table_name,
      v_stage_id,
      p_category_id,
      v_order,
      'pending',
      p_division
    );
  END LOOP;
  
  RETURN QUERY
  SELECT * FROM job_stage_instances
  WHERE job_id = p_job_id AND job_table_name = p_job_table_name;
END;
$$ LANGUAGE plpgsql;

-- Note: advance_job_stage, create_batch_master_job, and expedite_job_factory_wide
-- already inherit division from existing job_stage_instances records, so they don't need
-- the division parameter added. They will automatically use the correct division from
-- the records they're operating on.