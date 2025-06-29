
-- Add status column to business_card_jobs table to match other job tables
ALTER TABLE public.business_card_jobs 
ADD COLUMN status text NOT NULL DEFAULT 'queued';

-- Update any existing records to have the default status
UPDATE public.business_card_jobs 
SET status = 'queued' 
WHERE status IS NULL;
