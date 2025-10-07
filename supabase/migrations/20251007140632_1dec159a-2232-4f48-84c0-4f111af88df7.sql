-- Add RLS policy to allow reading proof_links by token
-- Needed for edge function to verify tokens when clients approve/reject proofs
CREATE POLICY "Allow reading proof links by token"
ON proof_links
FOR SELECT
TO public
USING (true);

-- Create simple index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_proof_links_token ON proof_links(token);