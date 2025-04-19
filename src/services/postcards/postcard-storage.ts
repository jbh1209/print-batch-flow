
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function uploadPostcardPDF(userId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `postcard-jobs/${userId}/${fileName}`;
  
  const { error: uploadError, data: fileData } = await supabase.storage
    .from('pdf_files')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });
    
  if (uploadError) {
    console.error('Error uploading PDF:', uploadError);
    throw new Error(`Failed to upload PDF: ${uploadError.message}`);
  }
  
  const { data: urlData } = await supabase.storage
    .from('pdf_files')
    .getPublicUrl(filePath);
    
  return urlData.publicUrl;
}

