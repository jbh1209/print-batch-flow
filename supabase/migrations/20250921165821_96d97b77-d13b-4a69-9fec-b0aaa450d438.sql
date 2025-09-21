-- Update all HP12000 stages without paper sizes to use "Large" (750x530mm)
UPDATE job_stage_instances 
SET 
  hp12000_paper_size_id = 'ba0589b6-6708-491a-9b18-e90dcaf62f23',
  updated_at = now()
WHERE production_stage_id IN (
  SELECT id FROM production_stages WHERE name LIKE '%HP 12000%'
) 
AND hp12000_paper_size_id IS NULL;