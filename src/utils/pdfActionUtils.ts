
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
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);
      
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
    
    // First check if the PDF is accessible by sending a HEAD request with credentials
    const checkResponse = await fetch(signedUrl, { 
      method: 'HEAD',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
    
    console.log(`PDF HEAD request status: ${checkResponse.status} ${checkResponse.statusText}`);
    console.log(`Response headers:`, Object.fromEntries([...checkResponse.headers.entries()]));
    
    if (!checkResponse.ok) {
      throw new Error(`PDF access error (${checkResponse.status}): ${checkResponse.statusText}`);
    }
    
    // Try to verify content type if possible
    const contentType = checkResponse.headers.get('content-type');
    if (contentType && !contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      console.warn(`Warning: Content type is not PDF: ${contentType}`);
    }
    
    if (action === 'view') {
      // Alternative method: fetch and create a blob URL
      if (contentType && contentType.includes('text/html')) {
        // If it's HTML, likely an error page, try to fetch and display actual error
        const response = await fetch(signedUrl);
        const text = await response.text();
        console.error("Received HTML instead of PDF:", text.substring(0, 500) + "...");
        throw new Error("Server returned HTML instead of PDF - likely an access error");
      }
      
      // Open in a new tab
      const newWindow = window.open(signedUrl, '_blank', 'noopener,noreferrer');
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        console.warn("Popup blocked or failed to open");
        toast.info("Opening PDF in current tab as popup was blocked");
        window.location.href = signedUrl;
      } else {
        // Show toast to check popup blocker if window might not have opened
        setTimeout(() => {
          toast.info("If the PDF didn't open, please check your popup blocker settings");
        }, 1000);
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
      
      if (error.message.includes("Could not generate")) {
        toast.error("Could not generate a secure access link for this PDF. Please check if you're logged in.");
      } else if (error.message.includes("403")) {
        toast.error("Permission denied: You don't have access to this PDF. This may be due to Supabase storage permissions.");
      } else if (error.message.includes("404")) {
        toast.error("PDF not found: The file may have been moved or deleted.");
      } else if (error.message.includes("CORS") || error.message.includes("cross-origin")) {
        toast.error("CORS error: The server is blocking access to the PDF from this domain.");
      } else if (error.message.includes("HTML")) {
        toast.error("Access denied: The server returned an error page instead of the PDF.");
      } else {
        toast.error(`Failed to access PDF: ${error.message.substring(0, 100)}`);
      }
    } else {
      toast.error("Failed to access PDF. Please ensure you're logged in.");
    }
    
    // Provide troubleshooting information
    toast.info("Try logging out and back in if you're experiencing permission issues");
  }
};
