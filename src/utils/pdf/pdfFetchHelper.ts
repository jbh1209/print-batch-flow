
import { PDFDocument } from "pdf-lib";
import { getSignedUrl } from "./signedUrlHelper";

// Helper function to fetch a PDF file with proper error handling
export async function fetchPdfWithRetry(url: string, jobId: string, retries = 1): Promise<ArrayBuffer | null> {
  try {
    if (!url) {
      console.error(`No URL provided for job ${jobId}`);
      return null;
    }
    
    // Get a signed URL for the file
    const signedUrl = await getSignedUrl(url);
    console.log(`Using signed URL for job ${jobId}`);
    
    // Add timestamp to prevent caching
    const nocacheUrl = `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}nocache=${Date.now()}`;
    console.log(`Using URL with cache busting: ${nocacheUrl.substring(0, 50)}...`);
    
    // Fetch the PDF with cache busting
    const response = await fetch(nocacheUrl, { 
      cache: 'no-store', // Force fresh fetch
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/pdf',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch PDF for job ${jobId}: ${response.statusText} (${response.status})`);
      
      if (retries > 0) {
        console.log(`Retrying fetch for job ${jobId}, ${retries} attempts left`);
        return await fetchPdfWithRetry(url, jobId, retries - 1);
      }
      
      return null;
    }
    
    const pdfBytes = await response.arrayBuffer();
    if (!pdfBytes || pdfBytes.byteLength === 0) {
      console.error(`Empty PDF file received for job ${jobId}`);
      return null;
    }
    
    console.log(`Successfully fetched PDF for job ${jobId}, size: ${pdfBytes.byteLength} bytes`);
    return pdfBytes;
  } catch (error) {
    console.error(`Error fetching PDF for job ${jobId}:`, error);
    return null;
  }
}

// Load a PDF document from fetched bytes
export async function loadPdfFromBytes(pdfBytes: ArrayBuffer, jobId: string): Promise<PDFDocument | null> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { 
      ignoreEncryption: true
    });
    
    const pageCount = pdfDoc.getPageCount();
    console.log(`PDF loaded with ${pageCount} pages for job ${jobId}`);
    
    if (pageCount === 0) {
      console.warn(`PDF has 0 pages for job ${jobId}`);
      return null;
    }
    
    return pdfDoc;
  } catch (error) {
    console.error(`Error parsing PDF for job ${jobId}:`, error);
    return null;
  }
}
