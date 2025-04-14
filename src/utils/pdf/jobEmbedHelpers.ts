
import { PDFDocument, rgb } from "pdf-lib";
import { mmToPoints } from "./pdfUnitHelpers";

// Embed the job PDF into the placeholder
export async function embedJobPDF(
  page: any,
  jobPdfDoc: PDFDocument,
  x: number,
  y: number,
  placeholderWidth: number,
  placeholderHeight: number,
  textAreaHeight: number
) {
  if (jobPdfDoc.getPageCount() > 0) {
    const [jobFirstPage] = await page.doc.embedPdf(jobPdfDoc, [0]);
    
    // Calculate scaling to fit the card area while preserving aspect ratio
    const originalWidth = jobFirstPage.width;
    const originalHeight = jobFirstPage.height;
    
    // Leave space for text at bottom
    const availableHeight = placeholderHeight - textAreaHeight;
    
    // Calculate scale factors for width and height
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
    
    // Draw the embedded PDF page
    page.drawPage(jobFirstPage, {
      x: embedX,
      y: embedY,
      width: scaledWidth,
      height: scaledHeight
    });
  }
}
