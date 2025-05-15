
// Let's check the declaration of handlePdfAction function
import { toast } from "sonner";

type PdfAction = 'view' | 'download';

export const handlePdfAction = async (url: string, action: PdfAction, fileName?: string) => {
  if (!url) {
    toast.error("No PDF URL provided");
    return;
  }

  try {
    if (action === 'view') {
      // Open in a new tab
      window.open(url, '_blank');
    } else if (action === 'download') {
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      
      // Use the provided fileName or extract from URL
      if (fileName) {
        link.download = fileName;
      } else {
        // Extract filename from URL or use a default
        const urlParts = url.split('/');
        link.download = urlParts[urlParts.length - 1] || 'document.pdf';
      }
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    toast.success(`PDF ${action === 'view' ? 'opened' : 'download started'}`);
  } catch (error) {
    console.error(`Error ${action === 'view' ? 'viewing' : 'downloading'} PDF:`, error);
    toast.error(`Failed to ${action} PDF`);
  }
};
