
import { toast } from "sonner";

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
    
    // First check if the PDF is accessible by sending a HEAD request with credentials
    const checkResponse = await fetch(url, { 
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
        const response = await fetch(url);
        const text = await response.text();
        console.error("Received HTML instead of PDF:", text.substring(0, 500) + "...");
        throw new Error("Server returned HTML instead of PDF - likely an access error");
      }
      
      // Open in a new tab
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        console.warn("Popup blocked or failed to open");
        toast.info("Opening PDF in current tab as popup was blocked");
        window.location.href = url;
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
      link.href = url;
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
      
      if (error.message.includes("403")) {
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
      toast.error("Failed to access PDF. Please check storage permissions in Supabase.");
    }
    
    // Provide troubleshooting information
    toast.info("Try opening the file directly in an incognito window to troubleshoot permissions");
  }
};
