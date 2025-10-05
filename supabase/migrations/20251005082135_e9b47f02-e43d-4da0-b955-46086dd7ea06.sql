-- Fix Paper & Print Specification Mapping Issues (V2 - Handle Duplicates)

-- Part 1: Delete unverified production_stage mappings with NULL production_stage_id
-- where a verified mapping with the same excel_text already exists
DELETE FROM excel_import_mappings AS eim1
WHERE eim1.mapping_type = 'production_stage'
  AND eim1.production_stage_id IS NULL
  AND eim1.is_verified = false
  AND EXISTS (
    SELECT 1 FROM excel_import_mappings AS eim2
    WHERE eim2.excel_text = eim1.excel_text
      AND eim2.production_stage_id IS NOT NULL
      AND eim2.is_verified = true
  );

-- Part 2: Delete ambiguous printing stage mappings with part suffixes
DELETE FROM excel_import_mappings
WHERE mapping_type = 'production_stage'
  AND production_stage_id IS NULL
  AND (
    excel_text ILIKE '% - cover%' OR
    excel_text ILIKE '% - text%' OR
    excel_text ILIKE '% (cover)%' OR
    excel_text ILIKE '% (text)%'
  );

-- Part 3: Unverify remaining production_stage mappings with NULL production_stage_id
UPDATE excel_import_mappings
SET 
  is_verified = false,
  confidence_score = LEAST(confidence_score, 50)
WHERE mapping_type = 'production_stage'
  AND production_stage_id IS NULL
  AND is_verified = true;