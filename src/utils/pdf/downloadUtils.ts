
/**
 * Opens a URL in a new browser tab
 * @param url The URL to open
 */
export const openInNewTab = (url: string): void => {
  const newWindow = window.open(url, '_blank');
  if (newWindow) newWindow.opener = null;
};

/**
 * Downloads a file from a URL
 * @param url The URL of the file to download
 * @param filename Optional filename for the downloaded file
 */
export const downloadFile = (url: string, filename?: string): void => {
  // Create an anchor element
  const anchor = document.createElement('a');
  anchor.href = url;
  
  // Set download attribute if filename is provided
  if (filename) {
    anchor.download = filename;
  }
  
  // Append to the document, click, and remove
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};
