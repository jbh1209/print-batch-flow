
import { PDFDocument, rgb } from "pdf-lib";
import { mmToPoints } from "./pdfUnitHelpers";

// Embed the job PDF into the placeholder with improved error handling
export async function embedJobPDF(
  page: any,
  jobPdfDoc: PDFDocument,
  x: number,
  y: number,
  placeholderWidth: number,
  placeholderHeight: number,
  textAreaHeight: number
) {
  try {
    if (!jobPdfDoc || jobPdfDoc.getPageCount() === 0) {
      console.error("Invalid PDF document or empty document provided to embedJobPDF");
      return;
    }
    
    const pageCount = jobPdfDoc.getPageCount();
    console.log(`Embedding PDF with ${pageCount} pages`);
    
    // Get the first page from the source document
    const [jobFirstPage] = await page.doc.embedPdf(jobPdfDoc, [0]);
    
    if (!jobFirstPage) {
      console.error("Failed to embed PDF page");
      return;
    }
    
    // Calculate scaling to fit the card area while preserving aspect ratio
    const originalWidth = jobFirstPage.width || 90;  // Default if width is not available
    const originalHeight = jobFirstPage.height || 50; // Default if height is not available
    
    // Leave space for text at bottom
    const availableHeight = placeholderHeight - textAreaHeight;
    
    // Calculate scale factors for width and height (with safety margins)
    const scaleX = (placeholderWidth - mmToPoints(6)) / originalWidth;
    const scaleY = (availableHeight - mmToPoints(6)) / originalHeight;
    
    // Use the smaller scale factor to ensure it fits
    const scale = Math.min(scaleX, scaleY);
    
    // Calculate dimensions after scaling
    const scaledWidth = originalWidth * scale;
    const scaledHeight = originalHeight * scale;
    
    // Calculate position to center within placeholder
    const embedX = x + (placeholderWidth - scaledWidth) / 2;
    const embedY = y + textAreaHeight + (availableHeight - scaledHeight) / 2;
    
    console.log(`Drawing embedded page at (${embedX}, ${embedY}) with size ${scaledWidth}x${scaledHeight}`);
    
    // Draw the embedded PDF page
    page.drawPage(jobFirstPage, {
      x: embedX,
      y: embedY,
      width: scaledWidth,
      height: scaledHeight
    });
    
    console.log("PDF page embedded successfully");
  } catch (error) {
    console.error("Error in embedJobPDF:", error);
  }
}
