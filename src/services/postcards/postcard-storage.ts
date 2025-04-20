
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function uploadPostcardPDF(userId: string, file: File): Promise<string> {
  if (!userId || !file) {
    throw new Error('Missing required parameters for file upload');
  }

  // Format should be the same across all job types in the app
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `postcard-jobs/${userId}/${fileName}`;
  
  try {
    console.log(`Uploading file to pdf_files/${filePath}`);
    
    const { error: uploadError } = await supabase.storage
      .from('pdf_files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
      
    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      toast.error('Failed to upload PDF file');
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('pdf_files')
      .getPublicUrl(filePath);
      
    if (!urlData?.publicUrl) {
      throw new Error('Failed to generate public URL for uploaded file');
    }
    
    console.log('PDF uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    toast.error('Failed to upload file. Please try again.');
    throw error;
  }
}
