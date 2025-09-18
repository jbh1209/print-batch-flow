-- Backfill part_name field for existing records where part_assignment exists but part_name is NULL
-- This fixes the disconnect between manual part assignments and downstream components

UPDATE job_stage_instances 
SET part_name = CASE 
  WHEN part_assignment = 'cover' THEN 'Cover'
  WHEN part_assignment = 'text' THEN 'Text' 
  WHEN part_assignment = 'both' THEN 'Both'
  ELSE NULL
END
WHERE part_assignment IS NOT NULL 
  AND part_assignment != ''
  AND part_name IS NULL;