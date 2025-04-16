
import { supabase } from "@/integrations/supabase/client";

export const getSignedUrl = async (url: string | null): Promise<string | null> => {
  if (!url) return null;
  
  try {
    console.log('Getting signed URL for:', url);
    
    // If it's already a signed URL, return as is
    if (url.includes('token=')) {
      console.log('URL is already signed');
      return url;
    }

    // Extract path parts for proper processing
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Check if this is a Supabase storage URL
    if (!path.includes('/storage/v1/object/public/')) {
      console.log('Not a Supabase storage URL, returning as is');
      return url;
    }
    
    // Extract the bucket and file path correctly
    // Format: /storage/v1/object/public/BUCKET_NAME/FILE_PATH
    const publicPos = path.indexOf('/public/');
    if (publicPos === -1) {
      console.warn('Could not find /public/ in URL path:', url);
      return url;
    }
    
    const relevantPath = path.substring(publicPos + 8); // Skip '/public/'
    const firstSlashPos = relevantPath.indexOf('/');
    
    if (firstSlashPos === -1) {
      console.warn('Could not find file path in URL:', url);
      return url;
    }
    
    const bucket = relevantPath.substring(0, firstSlashPos);
    const filePath = relevantPath.substring(firstSlashPos + 1);
    
    console.log('Extracted bucket:', bucket, 'path:', filePath);
    
    // Get signed URL from Supabase
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600);
      
    if (error) {
      console.error('Error getting signed URL:', error);
      return url;
    }
    
    console.log('Successfully generated signed URL');
    return data.signedUrl;
    
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return url;
  }
};
