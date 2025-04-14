
import { supabase } from "@/integrations/supabase/client";

// Helper function to get a signed URL for a storage object
export async function getSignedUrl(url: string): Promise<string> {
  try {
    if (!url) return '';
    
    // Extract the bucket and file path from the URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Look for bucket name (typically "pdf_files" or other bucket name)
    const bucketIndex = pathParts.findIndex(part => 
      part === 'pdf_files' || 
      part === 'batches' || 
      part.includes('_files')
    );
    
    if (bucketIndex === -1) {
      console.warn('Could not identify bucket in URL:', url);
      return url; // Return original URL if we can't parse it
    }
    
    const bucket = pathParts[bucketIndex];
    
    // Get file path - everything after the bucket name
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    console.log(`Creating signed URL for bucket: ${bucket}, file: ${filePath}`);
    
    // Create a signed URL with one hour expiry
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600, {
        download: true // Force download header for proper content type
      });
    
    if (error) {
      console.error('Error getting signed URL:', error);
      throw error;
    }
    
    console.log('Got signed URL successfully:', data.signedUrl.substring(0, 50) + '...');
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return url; // Fall back to original URL in case of errors
  }
}
