
-- Ensure the pdf_files bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdf_files',
  'pdf_files',
  true,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf'];

-- Create storage policies for pdf_files bucket
CREATE POLICY "Allow authenticated users to upload PDF files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pdf_files'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'batch-jobs'
);

CREATE POLICY "Allow public read access to PDF files"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdf_files');

CREATE POLICY "Allow authenticated users to update their PDF files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pdf_files'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to delete their PDF files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pdf_files'
  AND auth.role() = 'authenticated'
);
