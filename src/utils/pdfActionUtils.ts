
import { toast } from "sonner";
import { getSignedUrl } from "./pdf/urlUtils";
import { downloadFile, openInNewTab } from "./pdf/downloadUtils";
import { handlePdfError } from "./pdf/errorUtils";

/**
 * Handles PDF view or download actions
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
    
    // Get signed URL if needed
    const isAlreadySigned = url.includes('/sign/');
    const accessUrl = isAlreadySigned ? url : await getSignedUrl(url);
    
    if (!accessUrl) {
      throw new Error("Could not generate a valid URL for this PDF");
    }

    console.log(`Access URL generated: ${accessUrl.substring(0, 100)}...`);
    
    if (action === 'view') {
      openInNewTab(accessUrl);
    } else {
      const displayFilename = filename || url.split('/').pop() || 'document.pdf';
      downloadFile(accessUrl, displayFilename);
    }
  } catch (error) {
    handlePdfError(error);
  }
};
