-- Update the existing Box Gluing stage instance with proper configuration
UPDATE job_stage_instances 
SET 
  stage_specification_id = (SELECT id FROM stage_specifications WHERE name = 'Box Gluing'),
  estimated_duration_minutes = CASE 
    WHEN quantity IS NOT NULL THEN 
      15 + (quantity * 60.0 / 1200)  -- 15 min setup + quantity at 1200 items/hour
    ELSE 
      75  -- Default to 75 minutes (15 setup + 60 running time)
  END,
  part_assignment = 'both',
  updated_at = now()
WHERE id = 'ac6c53d5-a71c-4dc9-a2e1-68d31d29d161';