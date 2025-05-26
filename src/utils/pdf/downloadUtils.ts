
import { toast } from "sonner";

/**
 * Handles file download using a temporary link
 */
export const downloadFile = (url: string, filename: string): void => {
  // Clean up any existing temporary download links
  const existingLinks = document.querySelectorAll('a.pdf-download-link');
  existingLinks.forEach(link => document.body.removeChild(link));
  
  // Create a new temporary link
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.classList.add('pdf-download-link');
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clear any existing loading toasts and show success
  toast.dismiss();
  toast.success("Download complete");
};

/**
 * Opens a URL in a new tab with fallback
 */
export const openInNewTab = (url: string): void => {
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  
  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    console.warn("Popup blocked or failed to open");
    toast.dismiss();
    toast.info("Opening PDF in current tab as popup was blocked");
    window.location.href = url;
  } else {
    toast.dismiss();
    toast.success("PDF opened in new tab");
  }
};
