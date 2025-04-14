
import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { drawJobInfo } from "./jobInfoHelpers";
import { mmToPoints } from "./pdfUnitHelpers";

// Draw a specific page from a job PDF
export async function drawSpecificJobPage(
  page: any,
  x: number,
  y: number,
  pageData: { job: Job; pdfDoc: PDFDocument; page: number },
  placeholderWidth: number,
  placeholderHeight: number,
  textAreaHeight: number,
  helveticaFont: any,
  helveticaBold: any
) {
  const { job, pdfDoc, page: pageNumber } = pageData;
  
  // Draw placeholder border
  page.drawRectangle({
    x,
    y,
    width: placeholderWidth,
    height: placeholderHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.5,
    color: rgb(1, 1, 1) // White background
  });
  
  console.log(`Drawing page ${pageNumber} from job ${job.id} PDF (${pdfDoc.getPageCount()} pages available)`);
  
  try {
    // Check if the PDF has enough pages
    if (!pdfDoc || pdfDoc.getPageCount() <= pageNumber) {
      console.error(`PDF for job ${job.id} doesn't have page ${pageNumber}`);
      
      // Draw error message
      page.drawText("Page not found", {
        x: x + placeholderWidth / 2 - 40,
        y: y + placeholderHeight / 2,
        size: 10,
        font: helveticaFont,
        color: rgb(0.8, 0, 0) // Red text
      });
      
      // Still draw job info
      drawJobInfo(page, job, x, y, placeholderWidth, textAreaHeight, helveticaFont, helveticaBold);
      return;
    }
    
    // Get the specific page
    const sourcePage = pdfDoc.getPage(pageNumber);
    
    // Calculate scaling to fit the card area while preserving aspect ratio
    const originalWidth = sourcePage.getWidth();
    const originalHeight = sourcePage.getHeight();
    
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
    
    console.log(`Embedding page at position (${embedX}, ${embedY}) with size ${scaledWidth}x${scaledHeight}`);
    
    // Embed the page into the document - critical for rendering
    try {
      // Directly embed the page without timeout - simplified approach
      const embeddedPages = await page.doc.embedPdf(pdfDoc, [pageNumber]);
      
      if (!embeddedPages || embeddedPages.length === 0) {
        throw new Error(`Failed to embed page ${pageNumber} for job ${job.id}`);
      }
      
      const embeddedPage = embeddedPages[0];
      
      // Draw the embedded PDF page
      page.drawPage(embeddedPage, {
        x: embedX,
        y: embedY,
        width: scaledWidth,
        height: scaledHeight
      });
      
      console.log(`Successfully embedded page ${pageNumber} for job ${job.id}`);
    } catch (embedError) {
      console.error(`Error embedding page: ${embedError}`);
      
      // Draw error message
      page.drawText("Error embedding page", {
        x: x + placeholderWidth / 2 - 50,
        y: y + placeholderHeight / 2,
        size: 10,
        font: helveticaFont,
        color: rgb(0.8, 0, 0) // Red text
      });
    }
  } catch (error) {
    console.error(`Error embedding specific page for job ${job.id}:`, error);
    
    // Draw error message
    try {
      page.drawText(`Error: ${error.message || "Embedding failed"}`, {
        x: x + placeholderWidth / 2 - 50,
        y: y + placeholderHeight / 2,
        size: 8,
        font: helveticaFont,
        color: rgb(0.8, 0, 0) // Red text
      });
    } catch (drawError) {
      console.error(`Error drawing error message: ${drawError}`);
    }
  }
  
  // Draw job info at the bottom - always do this even if embedding fails
  drawJobInfo(page, job, x, y, placeholderWidth, textAreaHeight, helveticaFont, helveticaBold);
}
