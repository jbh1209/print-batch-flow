-- Fix NULL running_speed_per_hour values in production_stages
-- Set reasonable defaults based on stage types

UPDATE production_stages 
SET running_speed_per_hour = 1000  -- 1000 sheets per hour for general allocation/organization stages
WHERE name IN ('Batch Allocation', 'Completed', 'Laminating Queue') 
AND running_speed_per_hour IS NULL;

UPDATE production_stages 
SET running_speed_per_hour = 500   -- 500 sheets per hour for cutting operations
WHERE name IN ('Die Cutting', 'Zund') 
AND running_speed_per_hour IS NULL;

UPDATE production_stages 
SET running_speed_per_hour = 800   -- 800 sheets per hour for folding operations
WHERE name = 'Folding' 
AND running_speed_per_hour IS NULL;

UPDATE production_stages 
SET running_speed_per_hour = 300   -- 300 sheets per hour for manual handwork
WHERE name = 'Handwork' 
AND running_speed_per_hour IS NULL;

UPDATE production_stages 
SET running_speed_per_hour = 600   -- 600 sheets per hour for laminating operations
WHERE name IN ('Laminating', 'Laminating - Cover', 'Litho Lam') 
AND running_speed_per_hour IS NULL;

UPDATE production_stages 
SET running_speed_per_hour = 400   -- 400 sheets per hour for specialized book operations
WHERE name IN ('NCR Books', 'Saddle Stitching', 'Wire Binding', 'Padding') 
AND running_speed_per_hour IS NULL;

UPDATE production_stages 
SET running_speed_per_hour = 100   -- 100 jobs per hour for outsourcing (different unit)
WHERE name = 'Outsource' 
AND running_speed_per_hour IS NULL;

-- Printing stages: Set based on machine capabilities
UPDATE production_stages 
SET running_speed_per_hour = 1200  -- HP 12000: 1200 sheets per hour
WHERE name LIKE '%HP 12000%' 
AND running_speed_per_hour IS NULL;

UPDATE production_stages 
SET running_speed_per_hour = 900   -- 7900: 900 sheets per hour  
WHERE name LIKE '%7900%' 
AND running_speed_per_hour IS NULL;

UPDATE production_stages 
SET running_speed_per_hour = 250   -- T250: 250 sheets per hour
WHERE name LIKE '%T250%' 
AND running_speed_per_hour IS NULL;