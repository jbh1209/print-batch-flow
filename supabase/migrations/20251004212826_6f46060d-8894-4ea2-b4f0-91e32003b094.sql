-- Fix existing delivery_specification mappings by assigning them to the Shipping stage
-- This ensures all delivery method mappings are associated with the correct production stage

UPDATE excel_import_mappings
SET 
  production_stage_id = '761da7e3-b765-4d3f-9544-cdc6e2358ca6',
  updated_at = now()
WHERE 
  mapping_type = 'delivery_specification'
  AND production_stage_id IS NULL
  AND delivery_method_specification_id IS NOT NULL;