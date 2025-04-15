
import { supabase } from "@/integrations/supabase/client";

// Helper function to get a signed URL for a storage object
export async function getSignedUrl(url: string): Promise<string> {
  try {
    if (!url) return '';
    
    // Check if this is a Supabase storage URL
    if (!url.includes('storage.googleapis.com') && !url.includes('supabase')) {
      return url; // Not a storage URL, return as-is
    }
    
    console.log(`Getting signed URL for: ${url}`);
    
    // Extract bucket and path from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Find bucket name and file path using more robust extraction
    let bucket = '';
    let filePath = '';
    
    if (url.includes('/object/public/')) {
      // Handle URLs in format: /storage/v1/object/public/bucket-name/path/to/file
      const publicIndex = pathParts.indexOf('public');
      if (publicIndex !== -1 && publicIndex + 1 < pathParts.length) {
        bucket = pathParts[publicIndex + 1];
        filePath = pathParts.slice(publicIndex + 2).join('/');
      }
    } else if (url.includes('/object/sign/')) {
      // Handle URLs with sign in them
      const signIndex = pathParts.indexOf('sign');
      if (signIndex !== -1 && signIndex + 1 < pathParts.length) {
        bucket = pathParts[signIndex + 1];
        filePath = pathParts.slice(signIndex + 2).join('/');
      }
    }
    
    // If we couldn't parse properly, try a more generic approach
    if (!bucket || !filePath) {
      console.log(`Failed to parse URL using standard patterns, trying fallback: ${url}`);
      
      // Look for known patterns in the URL
      for (let i = 0; i < pathParts.length; i++) {
        if ((pathParts[i] === 'object' || pathParts[i] === 'storage') && i + 2 < pathParts.length) {
          bucket = pathParts[i + 2]; // Bucket typically follows after object/storage and v1
          filePath = pathParts.slice(i + 3).join('/');
          break;
        }
      }
    }
    
    // Try one more fallback if still not found
    if (!bucket && url.includes('/pdf_files/')) {
      bucket = 'pdf_files';
      const pdfIndex = url.indexOf('/pdf_files/');
      if (pdfIndex !== -1) {
        filePath = url.slice(pdfIndex + '/pdf_files/'.length);
      }
    }
    
    if (!bucket || !filePath) {
      console.warn('Could not parse bucket/path from URL:', url);
      return url;
    }
    
    console.log(`Extracted bucket: ${bucket}, path: ${filePath}`);
    
    // Create signed URL with 15 minute expiry
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 900);
    
    if (error) {
      console.error('Error getting signed URL:', error);
      return url;
    }
    
    console.log(`Successfully generated signed URL for ${bucket}/${filePath}`);
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return url;
  }
}
