
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Extracts bucket name and file path from a Supabase storage URL
 */
export const extractStoragePaths = (url: string) => {
  try {
    console.log("Extracting storage paths from URL:", url);
    
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Debug path parts to help troubleshoot path extraction
    console.log("URL path parts:", pathParts);
    
    // Look for "pdf_files" or other bucket name in the path
    const bucketIndex = pathParts.findIndex(part => 
      part === 'pdf_files' || 
      part === 'batches' || 
      part === 'objects' ||
      part.includes('_files')
    );
    
    if (bucketIndex === -1) {
      console.error('Could not identify bucket in URL:', url);
      return null;
    }
    
    // Handle different URL formats
    let bucket = pathParts[bucketIndex];
    let filePath;
    
    // Handle Supabase storage URL formats
    if (pathParts.includes('storage') && pathParts.includes('object')) {
      // Handle format: /storage/v1/object/public/BUCKET_NAME/FILE_PATH
      const publicIndex = pathParts.indexOf('public');
      
      if (publicIndex !== -1 && publicIndex + 1 < pathParts.length) {
        bucket = pathParts[publicIndex + 1];
        filePath = pathParts.slice(publicIndex + 2).join('/');
      } else {
        filePath = pathParts.slice(bucketIndex + 1).join('/');
      }
    } else {
      // Standard format
      filePath = pathParts.slice(bucketIndex + 1).join('/');
    }
    
    if (!filePath) {
      console.error('Could not extract file path from URL:', url);
      return null;
    }
    
    console.log(`Extracted bucket: ${bucket}, path: ${filePath}`);
    
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
  if (!url) {
    console.warn("No URL provided to getSignedUrl");
    return null;
  }
  
  try {
    // Check if it's already a signed URL
    if (url.includes('token=')) {
      console.log("URL is already signed, returning as is");
      return url;
    }
    
    console.log(`Creating signed URL for: ${url}`);
    
    const paths = extractStoragePaths(url);
    if (!paths) {
      console.warn("Could not extract storage paths, returning original URL");
      return url;
    }
    
    console.log(`Requesting signed URL for bucket: ${paths.bucket}, file: ${paths.filePath}`);
    
    const { data, error } = await supabase.storage
      .from(paths.bucket)
      .createSignedUrl(paths.filePath, expiresIn, {
        download: true,
      });
      
    if (error) {
      console.error('Error getting signed URL:', error);
      
      // Check if the error might be due to missing bucket
      const { data: buckets } = await supabase.storage.listBuckets();
      console.log("Available buckets:", buckets?.map(b => b.name));
      
      throw error;
    }
    
    console.log('Signed URL generated successfully');
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    toast.error('Failed to generate access URL for PDF');
    return url;
  }
};
