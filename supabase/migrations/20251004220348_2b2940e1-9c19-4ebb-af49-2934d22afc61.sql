-- Part 4: One-time database cleanup for delivery mappings and noisy duplicates

-- 4.1: Ensure all delivery_specification mappings with a valid delivery_method_specification_id 
-- have the Shipping stage assigned
UPDATE excel_import_mappings
SET 
  production_stage_id = '761da7e3-b765-4d3f-9544-cdc6e2358ca6',
  updated_at = now()
WHERE 
  mapping_type = 'delivery_specification'
  AND production_stage_id IS NULL
  AND delivery_method_specification_id IS NOT NULL;

-- 4.2: Unverify incomplete delivery_specification mappings that have no delivery_method_specification_id
-- These are incomplete and should not be used for matching
UPDATE excel_import_mappings
SET 
  is_verified = false,
  updated_at = now()
WHERE 
  mapping_type = 'delivery_specification'
  AND delivery_method_specification_id IS NULL;

-- 4.3: Unverify known noisy, duplicated-learned rows that were incorrectly auto-learned
-- These duplicate text entries provide no value and cause matching confusion
UPDATE excel_import_mappings
SET 
  is_verified = false,
  updated_at = now()
WHERE 
  LOWER(excel_text) IN (
    'collected by customer collected by customer',
    'deliver to one address in cape town deliver to one address in cape town'
  );