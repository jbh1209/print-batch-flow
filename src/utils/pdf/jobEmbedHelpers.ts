
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
      // Access the page before embedding to verify it exists
      const sourcePage = jobPdfDoc.getPage(0);
      if (!sourcePage) {
        throw new Error("Could not access page 0 of PDF");
      }

      // Embed the PDF page - critical for rendering
      console.log("Attempting to embed PDF page");
      // Force timeout increase for embedding
      const embedPromise = page.doc.embedPdf(jobPdfDoc, [0]);
      
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("PDF embedding timed out")), 10000);
      });
      
      // Race between embedding and timeout
      const [embeddedPages] = await Promise.race([
        embedPromise,
        timeoutPromise
      ]) as [any];
      
      const jobFirstPage = embeddedPages[0];
      
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
      const originalWidth = sourcePage.getWidth();
      const originalHeight = sourcePage.getHeight();
      
      console.log(`Original PDF dimensions: ${originalWidth}x${originalHeight}`);
      
      // Leave space for text at bottom
      const availableHeight = placeholderHeight - textAreaHeight;
      
      // Calculate scale factors for width and height (with safety margins)
      const scaleX = (placeholderWidth - mmToPoints(6)) / originalWidth;
      const scaleY = (availableHeight - mmToPoints(6)) / originalHeight;
      
      // Use the smaller scale factor to ensure it fits
      const scale = Math.min(scaleX, scaleY);
      console.log(`Scale factors - x: ${scaleX}, y: ${scaleY}, using: ${scale}`);
      
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
