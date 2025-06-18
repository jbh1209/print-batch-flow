
-- First, check what type the size column currently uses and update it
-- Since size_enum doesn't exist, the column is likely using a different type or no enum at all

-- Create the size_enum type
CREATE TYPE size_enum AS ENUM ('A6', 'A5', 'A4', 'DL', 'A3');

-- Update the flyer_jobs table to use the new enum
-- First, let's alter the column to use the new enum type
ALTER TABLE flyer_jobs 
  ALTER COLUMN size TYPE size_enum USING size::text::size_enum;

-- Update paper_weight column to support the new weights
-- Since paper_weight is a text field, we don't need to modify the column itself
-- But let's add a check constraint to ensure valid values
ALTER TABLE flyer_jobs 
  DROP CONSTRAINT IF EXISTS flyer_jobs_paper_weight_check;

ALTER TABLE flyer_jobs 
  ADD CONSTRAINT flyer_jobs_paper_weight_check 
  CHECK (paper_weight IN ('115gsm', '130gsm', '170gsm', '200gsm', '250gsm', '300gsm', '350gsm'));
