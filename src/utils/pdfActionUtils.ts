
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
    // First check if the PDF is accessible by sending a HEAD request
    const checkResponse = await fetch(url, { method: 'HEAD' });
    
    if (!checkResponse.ok) {
      throw new Error(`PDF access error (${checkResponse.status}): ${checkResponse.statusText}`);
    }
    
    if (action === 'view') {
      // Open in a new tab
      window.open(url, '_blank', 'noopener,noreferrer');
      
      // Show toast to check popup blocker if window might not have opened
      setTimeout(() => {
        toast.info("If the PDF didn't open, please check your popup blocker settings");
      }, 1000);
    } else {
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
    if (error instanceof Error && error.message.includes("403")) {
      toast.error("Permission denied: You don't have access to this PDF. This may be due to Supabase storage permissions.");
    } else if (error instanceof Error && error.message.includes("404")) {
      toast.error("PDF not found: The file may have been moved or deleted.");
    } else {
      toast.error("Failed to access PDF. Please check storage permissions in Supabase.");
    }
  }
};
