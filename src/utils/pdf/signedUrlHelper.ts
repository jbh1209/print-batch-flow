
import { supabase } from "@/integrations/supabase/client";

// Helper function to get a signed URL for a storage object
export async function getSignedUrl(url: string): Promise<string> {
  try {
    if (!url) return '';
    
    // Check if this is a Supabase storage URL
    if (!url.includes('storage.googleapis.com') && !url.includes('supabase')) {
      return url; // Not a storage URL, return as-is
    }
    
    // Extract bucket and path from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Find bucket name (typically between 'object' and 'public')
    let bucket = '';
    let filePath = '';
    
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i] === 'object' && i + 2 < pathParts.length) {
        bucket = pathParts[i + 1];
        filePath = pathParts.slice(i + 3).join('/');
        break;
      } else if (pathParts[i] === 'storage' && pathParts[i + 1] === 'v1' && i + 3 < pathParts.length) {
        bucket = pathParts[i + 2];
        filePath = pathParts.slice(i + 3).join('/');
        break;
      }
    }
    
    if (!bucket || !filePath) {
      console.warn('Could not parse bucket/path from URL:', url);
      return url;
    }
    
    // Create signed URL with 15 minute expiry
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 900);
    
    if (error) {
      console.error('Error getting signed URL:', error);
      return url;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return url;
  }
}
