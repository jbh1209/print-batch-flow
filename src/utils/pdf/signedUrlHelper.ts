
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

    // Extract bucket and path from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Find the bucket name (usually 'pdf_files' or similar)
    const bucketIndex = pathParts.findIndex(part => 
      part === 'pdf_files' || 
      part === 'storage' ||
      part.includes('_files')
    );
    
    if (bucketIndex === -1) {
      console.warn('Could not identify bucket in URL:', url);
      return url;
    }
    
    const bucket = pathParts[bucketIndex];
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
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
