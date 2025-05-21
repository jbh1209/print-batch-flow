
import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts bucket name and file path from a Supabase storage URL
 */
export const extractStoragePaths = (url: string) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Format: /storage/v1/object/public/BUCKET_NAME/FILE_PATH
    const publicIndex = pathParts.indexOf('public');
    
    if (publicIndex !== -1 && publicIndex < pathParts.length - 1) {
      const bucket = pathParts[publicIndex + 1];
      const filePath = pathParts.slice(publicIndex + 2).join('/');
      
      if (bucket && filePath) {
        return { bucket, filePath };
      }
    }
    
    // Legacy format - look for "pdf_files" or other bucket name in the path
    const bucketIndex = pathParts.findIndex(part => 
      part === 'pdf_files' || 
      part === 'batches' || 
      part.includes('_files')
    );
    
    if (bucketIndex === -1) {
      console.error('Could not identify bucket in URL:', url);
      return null;
    }
    
    const bucket = pathParts[bucketIndex];
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    if (!filePath) {
      console.error('Could not extract file path from URL:', url);
      return null;
    }
    
    return { bucket, filePath };
  } catch (error) {
    console.error('Error extracting paths from URL:', error);
    return null;
  }
};

/**
 * Gets a signed URL for accessing a PDF
 */
export const getSignedUrl = async (url: string | null, expiresIn = 3600): Promise<string | null> => {
  if (!url) return null;
  
  try {
    // If it's already a signed URL, return it as is
    if (url.includes('token=')) {
      console.log('URL is already signed, returning as is');
      return url;
    }
    
    console.log(`Processing URL for signing: ${url.substring(0, 50)}...`);
    
    const paths = extractStoragePaths(url);
    if (!paths) {
      console.warn('Could not extract paths from URL, using original URL:', url);
      return url;
    }
    
    console.log(`Requesting signed URL for bucket: ${paths.bucket}, file: ${paths.filePath}`);
    
    try {
      const { data, error } = await supabase.storage
        .from(paths.bucket)
        .createSignedUrl(paths.filePath, expiresIn, {
          download: true,
        });
        
      if (error) {
        console.error('Error getting signed URL:', error);
        console.error('Error details:', error.message);
        // Return the original URL as fallback if signing fails
        return url;
      }
      
      console.log('Signed URL generated successfully');
      return data.signedUrl;
    } catch (signError) {
      console.error('Exception in createSignedUrl:', signError);
      return url;
    }
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return url;
  }
};
