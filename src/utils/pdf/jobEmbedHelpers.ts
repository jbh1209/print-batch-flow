
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
    if (!jobPdfDoc) {
      console.error("No PDF document provided to embedJobPDF");
      
      // Draw error message
      page.drawText("No PDF available", {
        x: x + placeholderWidth / 2 - 40,
        y: y + placeholderHeight / 2,
        size: 10,
        color: rgb(0.8, 0, 0)
      });
      return;
    }
    
    const pageCount = jobPdfDoc.getPageCount();
    console.log(`Embedding PDF with ${pageCount} pages`);
    
    if (pageCount === 0) {
      console.error("PDF document has no pages");
      
      // Draw error message
      page.drawText("PDF has no pages", {
        x: x + placeholderWidth / 2 - 45,
        y: y + placeholderHeight / 2,
        size: 10,
        color: rgb(0.8, 0, 0)
      });
      return;
    }
    
    // Get the first page from the source document
    try {
      // Embed the PDF page - critical for rendering
      const [jobFirstPage] = await page.doc.embedPdf(jobPdfDoc, [0]);
      
      if (!jobFirstPage) {
        console.error("Failed to embed PDF page");
        
        // Draw error message
        page.drawText("Failed to embed PDF", {
          x: x + placeholderWidth / 2 - 50,
          y: y + placeholderHeight / 2,
          size: 10,
          color: rgb(0.8, 0, 0)
        });
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
    } catch (embedError) {
      console.error("Error embedding PDF:", embedError);
      
      // Draw error message
      page.drawText("Error embedding PDF", {
        x: x + placeholderWidth / 2 - 50,
        y: y + placeholderHeight / 2,
        size: 10,
        color: rgb(0.8, 0, 0)
      });
    }
  } catch (error) {
    console.error("Error in embedJobPDF:", error);
    
    // Draw error message as a fallback
    try {
      page.drawText("PDF Error", {
        x: x + placeholderWidth / 2 - 30,
        y: y + placeholderHeight / 2,
        size: 10,
        color: rgb(0.8, 0, 0)
      });
    } catch (drawError) {
      console.error("Error drawing error message:", drawError);
    }
  }
}
