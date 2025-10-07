-- Add email tracking columns to proof_links table
ALTER TABLE proof_links 
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_send_error TEXT;

-- Add index for email tracking queries
CREATE INDEX IF NOT EXISTS idx_proof_links_email_sent 
ON proof_links(email_sent_at) 
WHERE email_sent_at IS NOT NULL;

COMMENT ON COLUMN proof_links.email_sent_at IS 'Timestamp when proof email was successfully sent';
COMMENT ON COLUMN proof_links.email_send_error IS 'Error message if email sending failed';