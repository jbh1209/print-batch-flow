-- Create storage bucket for proof PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('proof-pdfs', 'proof-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload proof PDFs
CREATE POLICY "Authenticated users can upload proof PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proof-pdfs');

-- Allow authenticated users to read proof PDFs
CREATE POLICY "Authenticated users can view proof PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'proof-pdfs');

-- Allow public access to proof PDFs (needed for client viewing via proof link)
CREATE POLICY "Public can access proof PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'proof-pdfs');