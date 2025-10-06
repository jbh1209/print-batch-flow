-- Phase 6: Add tracking columns to proof_links table for admin management

-- Add tracking columns
ALTER TABLE proof_links 
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invalidated_by UUID REFERENCES auth.users(id);

-- Add indexes for faster admin queries
CREATE INDEX IF NOT EXISTS idx_proof_links_status 
ON proof_links(is_used, expires_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proof_links_job_lookup 
ON proof_links(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proof_links_token_lookup
ON proof_links(token) WHERE is_used = false;

-- Add comment for documentation
COMMENT ON COLUMN proof_links.viewed_at IS 'Timestamp when client first viewed the proof link';
COMMENT ON COLUMN proof_links.resend_count IS 'Number of times the proof email was resent';
COMMENT ON COLUMN proof_links.invalidated_at IS 'Timestamp when link was manually invalidated by admin';
COMMENT ON COLUMN proof_links.invalidated_by IS 'Admin user who invalidated the link';