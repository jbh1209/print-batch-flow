
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
    const bucketIndex = pathParts.findIndex(part => part === 'pdf_files');
    
    if (bucketIndex === -1) {
      console.error('Could not parse bucket from URL:', url);
      return null;
    }
    
    const bucket = pathParts[bucketIndex];
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    console.log(`Requesting signed URL for bucket: ${bucket}, file: ${filePath}`);
    
    // Generate a direct download URL with download=true query parameter
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn, {
        download: true, // Force download header to be set for proper content type
        transform: { // No transformations for PDFs
          quality: 100
        }
      });
      
    if (error) {
      console.error('Error getting signed URL:', error);
      throw error;
    }
    
    console.log('Signed URL generated successfully');
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
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
    
    // Get signed URL for secure access
    const signedUrl = await getSignedUrl(url);
    
    if (!signedUrl) {
      throw new Error("Could not generate a signed URL for this PDF");
    }

    console.log(`Signed URL generated: ${signedUrl.substring(0, 100)}...`);
    
    if (action === 'view') {
      // Open in a new tab
      const newWindow = window.open(signedUrl, '_blank', 'noopener,noreferrer');
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        console.warn("Popup blocked or failed to open");
        toast.info("Opening PDF in current tab as popup was blocked");
        window.location.href = signedUrl;
      } else {
        toast.success("PDF opened in new tab");
      }
    } else {
      console.log(`Initiating download of ${filename || url.split('/').pop()}`);
      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = filename || url.split('/').pop() || 'batch-pdf.pdf';
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
      
      toast.error(`PDF access error: ${error.message}`);
      toast.info("Try logging out and back in if you're experiencing permission issues");
    } else {
      toast.error("Failed to access PDF. Please ensure you're logged in.");
    }
  }
};
