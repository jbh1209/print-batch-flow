-- Add contact_email column to production_jobs table
ALTER TABLE public.production_jobs 
ADD COLUMN contact_email text;

-- Add comment for documentation
COMMENT ON COLUMN public.production_jobs.contact_email IS 'Email address for proof approval notifications';

-- Create index for faster email lookups
CREATE INDEX idx_production_jobs_contact_email ON public.production_jobs(contact_email) WHERE contact_email IS NOT NULL;