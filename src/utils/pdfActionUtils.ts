
import { toast } from "sonner";

/**
 * Handles PDF actions like viewing or downloading
 * @param url The URL of the PDF to operate on
 * @param action The action to perform ('view' or 'download')
 * @returns void
 */
export const handlePdfAction = (url: string | null, action: 'view' | 'download') => {
  if (!url) {
    toast.error('No PDF URL provided');
    return;
  }

  try {
    if (action === 'view') {
      // Open PDF in a new tab
      window.open(url, '_blank');
    } else if (action === 'download') {
      // Create a temporary link to trigger the download
      const link = document.createElement('a');
      link.href = url;
      link.download = `document-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error(`Error ${action === 'view' ? 'viewing' : 'downloading'} PDF:`, error);
    toast.error(`Failed to ${action === 'view' ? 'view' : 'download'} PDF. Please try again.`);
  }
};
