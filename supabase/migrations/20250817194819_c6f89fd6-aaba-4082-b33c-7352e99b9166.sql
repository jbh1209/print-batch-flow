-- Add proof_approved_at column to production_jobs table for FIFO scheduling
ALTER TABLE public.production_jobs 
ADD COLUMN proof_approved_at timestamp with time zone;

-- Update existing records to use created_at as fallback for proof_approved_at
UPDATE public.production_jobs 
SET proof_approved_at = created_at 
WHERE proof_approved_at IS NULL;