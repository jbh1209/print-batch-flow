
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Gets a signed URL for accessing a PDF
 * @param url Original storage URL path
 * @param expiresIn Number of seconds until the URL expires (default 60 minutes)
 * @returns Promise resolving to a signed URL
 */
const getSignedUrl = async (url: string | null, expiresIn = 3600): Promise<string | null> => {
  if (!url) return null;
  
  try {
    // Extract the bucket and path from the URL
    // URL format: https://[project_id].supabase.co/storage/v1/object/public/pdf_files/path/to/file.pdf
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Look for "pdf_files" or other bucket name in the path
    const bucketIndex = pathParts.findIndex(part => 
      part === 'pdf_files' || 
      part === 'batches' || 
      part.includes('_files')
    );
    
    if (bucketIndex === -1) {
      console.error('Could not identify bucket in URL:', url);
      return url; // Return original URL if we can't parse it
    }
    
    const bucket = pathParts[bucketIndex];
    
    // Get the file path - everything after the bucket name
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    if (!filePath) {
      console.error('Could not extract file path from URL:', url);
      return url;
    }
    
    console.log(`Requesting signed URL for bucket: ${bucket}, file: ${filePath}`);
    
    // Generate a direct download URL with download parameter
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn, {
        download: true, // Force download header for proper content type
      });
      
    if (error) {
      console.error('Error getting signed URL:', error);
      throw error;
    }
    
    console.log('Signed URL generated successfully');
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return url; // Fall back to original URL in case of errors
  }
};

/**
 * Handles PDF view or download actions
 * @param url URL of the PDF to view or download
 * @param action Action to perform - 'view' or 'download'
 * @param filename Optional filename for download (defaults to the last part of the URL)
 */
export const handlePdfAction = async (
  url: string | null,
  action: 'view' | 'download',
  filename?: string
): Promise<void> => {
  if (!url) {
    toast.error("PDF URL is not available");
    return;
  }

  try {
    console.log(`Attempting to access PDF at: ${url}`);
    
    // First check if URL contains "/sign/" which indicates it's already a signed URL
    const isAlreadySigned = url.includes('/sign/');
    
    // Get signed URL for secure access if not already signed
    const accessUrl = isAlreadySigned ? url : await getSignedUrl(url);
    
    if (!accessUrl) {
      throw new Error("Could not generate a valid URL for this PDF");
    }

    console.log(`Access URL generated: ${accessUrl.substring(0, 100)}...`);
    
    if (action === 'view') {
      // Open in a new tab
      const newWindow = window.open(accessUrl, '_blank', 'noopener,noreferrer');
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        console.warn("Popup blocked or failed to open");
        toast.info("Opening PDF in current tab as popup was blocked");
        window.location.href = accessUrl;
      } else {
        toast.success("PDF opened in new tab");
      }
    } else {
      const displayFilename = filename || url.split('/').pop() || 'document.pdf';
      console.log(`Initiating download of ${displayFilename}`);
      
      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = accessUrl;
      link.download = displayFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Download initiated");
    }
  } catch (error) {
    console.error("Error accessing PDF:", error);
    
    // Provide a more helpful error message based on the error
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      
      // Check for common errors
      if (error.message.includes('invalid source image') || error.message.includes('422')) {
        toast.error("PDF format error: The system couldn't process this file");
      } else if (error.message.includes('permission') || error.message.includes('403')) {
        toast.error("Permission denied: You may need to log in again to access this file");
      } else {
        toast.error(`PDF access error: ${error.message}`);
      }
    } else {
      toast.error("Failed to access PDF. Please ensure you're logged in.");
    }
    
    // Always provide helpful recovery advice
    toast.info("If problems persist, try refreshing the page or logging out and back in");
  }
};
