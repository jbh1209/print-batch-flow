
import { supabase } from "@/integrations/supabase/client";

export const getSignedUrl = async (url: string | null): Promise<string | null> => {
  if (!url) return null;
  
  try {
    // If it's already a signed URL, return as is
    if (url.includes('token=')) {
      return url;
    }

    // Extract bucket name and file path
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Format: /storage/v1/object/public/BUCKET_NAME/FILE_PATH
    const publicIndex = pathParts.indexOf('public');
    
    if (publicIndex === -1 || publicIndex === pathParts.length - 1) {
      return url;
    }
    
    const bucket = pathParts[publicIndex + 1];
    const filePath = pathParts.slice(publicIndex + 2).join('/');
    
    if (!bucket || !filePath) {
      console.warn('Could not extract bucket or file path from URL:', url);
      return url;
    }
    
    console.log('Getting signed URL for bucket:', bucket, 'path:', filePath);
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600);
      
    if (error) {
      console.error('Error getting signed URL:', error);
      return url;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return url;
  }
};
