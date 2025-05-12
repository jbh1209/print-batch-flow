
/**
 * Utility functions for handling PDF downloads and viewing
 */

/**
 * Opens the provided URL in a new browser tab
 * @param url URL to open in new tab
 */
export const openInNewTab = (url: string): void => {
  const newWindow = window.open(url, '_blank');
  if (!newWindow) {
    console.error('Failed to open new tab. This might be due to popup blocking.');
  }
};

/**
 * Initiates a file download for the provided URL
 * @param url URL of the file to download
 * @param filename Suggested filename for the download
 */
export const downloadFile = (url: string, filename: string): void => {
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error initiating download:', error);
    openInNewTab(url); // Fallback to opening in new tab
  }
};
