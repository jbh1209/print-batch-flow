
import { toast } from "sonner";
import { downloadFile, openInNewTab } from "./pdf/downloadUtils";
import { handlePdfError } from "./pdf/errorUtils";
import { secureGetPdfUrl, logPdfAccess } from "./pdf/securityUtils";

/**
 * Handles PDF view or download actions with enhanced security
 */
export const handlePdfAction = async (
  url: string | null,
  action: 'view' | 'download',
  filename?: string,
  jobUserId?: string
): Promise<void> => {
  if (!url) {
    toast.error("PDF URL is not available");
    return;
  }

  try {
    console.log(`Attempting secure access to PDF: ${action}`);
    
    // Get secured and validated URL
    const accessUrl = await secureGetPdfUrl(url, jobUserId);
    
    if (!accessUrl) {
      throw new Error("Could not securely access this PDF");
    }

    // Log access for security auditing
    logPdfAccess(url, action);
    
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
