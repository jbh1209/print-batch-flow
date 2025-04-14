
import { toast } from "sonner";

/**
 * Handles PDF view or download actions
 * @param url URL of the PDF to view or download
 * @param action Action to perform - 'view' or 'download'
 * @param filename Optional filename for download (defaults to the last part of the URL)
 */
export const handlePdfAction = (
  url: string | null,
  action: 'view' | 'download',
  filename?: string
): void => {
  if (!url) {
    toast.error("PDF URL is not available");
    return;
  }

  try {
    if (action === 'view') {
      // Open in a new tab
      window.open(url, '_blank');
    } else {
      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || url.split('/').pop() || 'batch-pdf.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error("Error handling PDF:", error);
    toast.error("Failed to process PDF. Please try again.");
  }
};
