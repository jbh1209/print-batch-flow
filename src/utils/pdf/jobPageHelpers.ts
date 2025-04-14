
import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { drawJobInfo } from "./jobInfoHelpers";
import { mmToPoints } from "./pdfUnitHelpers";
import { PositionMapping } from "./jobPdfLoader";

/**
 * Draw a specific page from a job PDF
 * Complete rewrite with separated embedding and drawing
 */
export async function drawSpecificJobPage(
  page: any,
  x: number,
  y: number,
  positionMapping: PositionMapping,
  placeholderWidth: number,
  placeholderHeight: number,
  textAreaHeight: number,
  helveticaFont: any,
  helveticaBold: any
) {
  const { job, page: pageNumber, embeddedPage } = positionMapping;
  
  // Draw placeholder border and background
  page.drawRectangle({
    x,
    y,
    width: placeholderWidth,
    height: placeholderHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.5,
    color: rgb(1, 1, 1) // White background
  });
  
  console.log(`Drawing job ${job.id} (${job.name}) at position (${x}, ${y})`);
  
  try {
    // Verify we have an embedded page to draw
    if (!embeddedPage) {
      console.error(`No embedded page available for job ${job.id} position ${positionMapping.position}`);
      throw new Error("No embedded page available");
    }
    
    // Get source page dimensions from the original PDF document
    let originalWidth = 0;
    let originalHeight = 0;
    
    try {
      const sourcePage = positionMapping.pdfDoc.getPage(pageNumber);
      originalWidth = sourcePage.getWidth();
      originalHeight = sourcePage.getHeight();
    } catch (dimensionError) {
      console.error(`Error getting source page dimensions for job ${job.id}:`, dimensionError);
      // Use fallback dimensions if necessary
      originalWidth = 595; // A4 width in points
      originalHeight = 842; // A4 height in points
    }
    
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
    
    console.log(`Drawing embedded page for job ${job.id} at (${embedX}, ${embedY}) with size ${scaledWidth}x${scaledHeight}`);
    
    // Draw the embedded PDF page
    page.drawPage(embeddedPage, {
      x: embedX,
      y: embedY,
      width: scaledWidth,
      height: scaledHeight
    });
    
  } catch (error) {
    console.error(`Error drawing specific page for job ${job.id}:`, error);
    
    // Draw error message
    try {
      page.drawText(`Error: ${error instanceof Error ? error.message : "Drawing failed"}`, {
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
