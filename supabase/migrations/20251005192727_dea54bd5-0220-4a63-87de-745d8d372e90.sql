-- Add estimated completion tracking to proof_links table
ALTER TABLE proof_links 
ADD COLUMN estimated_completion_date timestamptz,
ADD COLUMN scheduling_results jsonb DEFAULT '{}'::jsonb,
ADD COLUMN client_ip_address text,
ADD COLUMN client_user_agent text;

-- Create index for faster lookups
CREATE INDEX idx_proof_links_estimated_completion ON proof_links(estimated_completion_date);