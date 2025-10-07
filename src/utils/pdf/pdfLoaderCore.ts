import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { getSignedUrl } from "./urlUtils";

// Load a PDF document as raw bytes to avoid reference issues entirely
export async function loadPdfAsBytes(url: string, jobId: string): Promise<{ buffer: ArrayBuffer, pageCount: number } | null> {
  try {
    if (!url) {
      console.error(`No URL provided for job ${jobId}`);
      return null;
    }
    
    console.log(`Fetching PDF for job ${jobId} from URL: ${url}`);

    // Get a signed URL for Supabase storage
    let fetchUrl = url;
    if (url.includes('supabase.co/storage') || url.includes('storage.googleapis.com')) {
      fetchUrl = await getSignedUrl(url);
      console.log(`Using signed URL for job ${jobId}: ${fetchUrl}`);
    }
    
    // Basic fetch with cache control and longer timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(fetchUrl, { 
        cache: 'no-store',
        headers: { 
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`Failed to fetch PDF for job ${jobId}: ${response.status} ${response.statusText}`);
        return null;
      }
      
      // Get raw bytes
      const buffer = await response.arrayBuffer();
      if (!buffer || buffer.byteLength === 0) {
        console.error(`Empty PDF received for job ${jobId}`);
        return null;
      }
      
      // Load temporarily to get page count then discard the PDF object
      const tempPdf = await PDFDocument.load(buffer.slice(0)); // Use a copy of the buffer
      const pageCount = tempPdf.getPageCount();
      
      console.log(`Successfully loaded PDF for job ${jobId}: ${buffer.byteLength} bytes, ${pageCount} pages`);
      
      // Return both the raw buffer and page count
      return { buffer, pageCount };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error(`Error loading PDF for job ${jobId}:`, error);
    return null;
  }
}

// Create an empty PDF with a given text message
export async function createEmptyPdfBytes(message: string): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  
  // Draw error message centered
  const { width, height } = page.getSize();
  page.drawText(message, {
    x: width / 2 - 100,
    y: height / 2,
    size: 14
  });
  
  const pdfBytes = await pdfDoc.save();
  return pdfBytes.buffer.slice(0) as ArrayBuffer;
}
