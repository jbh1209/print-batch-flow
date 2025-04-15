
import { PDFDocument, PDFPage, rgb, StandardFonts, RotationTypes } from "pdf-lib";
import { mmToPoints } from "./pdfUnitHelpers";
import { ProcessedJobPages } from "./PdfPageProcessor";

export interface ImpositionSlot {
  position: number;     // Position on the sheet (0-23 for 3x8 grid)
  jobId: string;        // ID of the job this slot belongs to
  jobName: string;      // Name of the job
  pdfBytes: ArrayBuffer;// The PDF content for this slot
  isBack: boolean;      // Whether this is a back page
  quantity: number;     // Quantity of cards for this slot
}

export interface SheetDimensions {
  pageWidth: number;
  pageHeight: number;
  placeholderWidth: number;
  placeholderHeight: number;
  columns: number;
  rows: number;
  horizontalMargin: number;
  verticalMargin: number;
  textAreaHeight: number;
}

/**
 * Creates imposition slots for front and back pages
 */
export function createImpositionSlots(
  processedJobs: ProcessedJobPages[],
  quantityMap: Map<string, number>
): { frontSlots: ImpositionSlot[], backSlots: ImpositionSlot[] } {
  console.log(`Creating imposition slots for ${processedJobs.length} jobs`);
  
  const frontSlots: ImpositionSlot[] = [];
  const backSlots: ImpositionSlot[] = [];
  let currentPosition = 0;
  
  for (const job of processedJobs) {
    console.log(`Assigning slots for job "${job.jobName}" - Front pages: ${job.frontPages.length}, Back pages: ${job.backPages.length}`);
    
    // Get quantity per slot for this job
    const quantity = quantityMap.get(job.jobId) || 0;
    
    // Assign front pages to slots
    for (let i = 0; i < job.frontPages.length; i++) {
      if (currentPosition >= 24) {
        console.warn(`Warning: Exceeded maximum slots (24). Some content may be omitted.`);
        break;
      }
      
      frontSlots.push({
        position: currentPosition,
        jobId: job.jobId,
        jobName: job.jobName,
        pdfBytes: job.frontPages[i],
        isBack: false,
        quantity
      });
      
      // If job is double-sided and has back pages, assign corresponding back page
      if (job.isDoubleSided && i < job.backPages.length) {
        backSlots.push({
          position: currentPosition,
          jobId: job.jobId,
          jobName: job.jobName,
          pdfBytes: job.backPages[i],
          isBack: true,
          quantity
        });
      }
      
      currentPosition++;
    }
  }
  
  console.log(`Created ${frontSlots.length} front slots and ${backSlots.length} back slots`);
  return { frontSlots, backSlots };
}

/**
 * Calculate dimensions for the imposition grid
 */
export function calculateSheetDimensions(pageWidth: number, pageHeight: number): SheetDimensions {
  // Card dimensions (90x50mm with 3mm bleed area)
  const placeholderWidth = mmToPoints(96);
  const placeholderHeight = mmToPoints(56);
  
  // Grid layout (3x8 grid)
  const columns = 3;
  const rows = 8;
  
  // Calculate margins to center on the sheet
  const totalGridWidth = columns * placeholderWidth;
  const totalGridHeight = rows * placeholderHeight;
  
  const horizontalMargin = (pageWidth - totalGridWidth) / 2;
  const verticalMargin = (pageHeight - totalGridHeight) / 2;
  
  return {
    pageWidth,
    pageHeight,
    placeholderWidth,
    placeholderHeight,
    columns,
    rows,
    horizontalMargin,
    verticalMargin,
    textAreaHeight: mmToPoints(8)
  };
}

/**
 * Creates a complete imposition sheet (front or back) with all slots
 */
export async function createImpositionSheet(
  slots: ImpositionSlot[],
  dimensions: SheetDimensions,
  pageType: "Front" | "Back",
  batchName: string
): Promise<PDFDocument> {
  console.log(`Creating ${pageType} imposition sheet with ${slots.length} slots`);
  
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([dimensions.pageWidth, dimensions.pageHeight]);
  
  // Load fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Draw side information
  drawSideInfo(page, pageType, batchName, helveticaFont, helveticaBold);
  
  // Fill all positions (24 total) with either content or empty placeholders
  const filledSlots = new Array(dimensions.columns * dimensions.rows).fill(null);
  
  // Fill in the slots we have content for
  for (const slot of slots) {
    if (slot.position < filledSlots.length) {
      filledSlots[slot.position] = slot;
    }
  }
  
  // Draw each position in the grid
  for (let row = 0; row < dimensions.rows; row++) {
    for (let col = 0; col < dimensions.columns; col++) {
      const position = row * dimensions.columns + col;
      const slot = filledSlots[position];
      
      // Calculate position
      const x = dimensions.horizontalMargin + col * dimensions.placeholderWidth;
      const y = page.getHeight() - dimensions.verticalMargin - (row + 1) * dimensions.placeholderHeight;
      
      if (slot) {
        // Draw slot with content
        await drawSlotWithContent(
          pdfDoc,
          page,
          slot,
          x,
          y,
          dimensions,
          helveticaFont,
          helveticaBold
        );
      } else {
        // Draw empty placeholder
        drawEmptyPlaceholder(
          page,
          x,
          y,
          dimensions.placeholderWidth,
          dimensions.placeholderHeight,
          helveticaFont
        );
      }
    }
  }
  
  return pdfDoc;
}

/**
 * Draw a single slot with content
 */
async function drawSlotWithContent(
  pdfDoc: PDFDocument,
  page: PDFPage,
  slot: ImpositionSlot,
  x: number,
  y: number,
  dimensions: SheetDimensions,
  helveticaFont: any,
  helveticaBold: any
): Promise<void> {
  try {
    // Draw placeholder border and background
    page.drawRectangle({
      x,
      y,
      width: dimensions.placeholderWidth,
      height: dimensions.placeholderHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.5,
      color: rgb(1, 1, 1) // White background
    });
    
    // Embed and draw PDF for this slot
    try {
      // Load PDF from bytes
      const embedPdf = await PDFDocument.load(slot.pdfBytes);
      
      // Check if it has pages
      if (embedPdf.getPageCount() > 0) {
        // Embed the first page
        const [embedPage] = await pdfDoc.embedPdf(embedPdf, [0]);
        
        if (embedPage) {
          // Get source dimensions
          const sourcePage = embedPdf.getPage(0);
          const originalWidth = sourcePage.getWidth();
          const originalHeight = sourcePage.getHeight();
          
          // Leave space for text at bottom
          const availableHeight = dimensions.placeholderHeight - dimensions.textAreaHeight;
          
          // Calculate scale factors with margins
          const scaleX = (dimensions.placeholderWidth - mmToPoints(6)) / originalWidth;
          const scaleY = (availableHeight - mmToPoints(6)) / originalHeight;
          
          // Use the smaller scale factor
          const scale = Math.min(scaleX, scaleY);
          
          // Calculate dimensions and position
          const scaledWidth = originalWidth * scale;
          const scaledHeight = originalHeight * scale;
          
          // Center within placeholder
          const embedX = x + (dimensions.placeholderWidth - scaledWidth) / 2;
          const embedY = y + dimensions.textAreaHeight + (availableHeight - scaledHeight) / 2;
          
          // Draw the embedded page
          page.drawPage(embedPage, {
            x: embedX,
            y: embedY,
            width: scaledWidth,
            height: scaledHeight
          });
        }
      }
    } catch (error) {
      console.error(`Error embedding PDF for slot ${slot.position}:`, error);
      
      // Draw error message
      page.drawText(`Error: ${error instanceof Error ? error.message : "Drawing failed"}`, {
        x: x + dimensions.placeholderWidth / 2 - 50,
        y: y + dimensions.placeholderHeight / 2,
        size: 8,
        font: helveticaFont,
        color: rgb(0.8, 0, 0) // Red text
      });
    }
    
    // Draw job info at bottom
    drawJobInfo(
      page,
      slot,
      x,
      y,
      dimensions.placeholderWidth,
      dimensions.textAreaHeight,
      helveticaFont,
      helveticaBold
    );
  } catch (error) {
    console.error(`Error drawing slot ${slot.position}:`, error);
    
    // Draw a minimal error placeholder
    drawEmptyPlaceholder(page, x, y, dimensions.placeholderWidth, dimensions.placeholderHeight, helveticaFont);
  }
}

/**
 * Draw job info at bottom of card
 */
function drawJobInfo(
  page: PDFPage,
  slot: ImpositionSlot,
  x: number,
  y: number,
  placeholderWidth: number,
  textAreaHeight: number,
  helveticaFont: any,
  helveticaBold: any
): void {
  try {
    // Draw black background for text area
    page.drawRectangle({
      x,
      y,
      width: placeholderWidth,
      height: textAreaHeight,
      color: rgb(0, 0, 0),
    });
    
    // Format job name
    let jobName = slot.jobName || "Untitled Job";
    if (jobName.length > 12) {
      jobName = jobName.substring(0, 9) + "...";
    }
    
    // Draw job name
    page.drawText(jobName, {
      x: x + 12,
      y: y + textAreaHeight/2 + 1,
      size: 7,
      font: helveticaBold,
      color: rgb(1, 1, 1) // White text
    });
    
    // Draw job ID
    const jobId = slot.jobId ? slot.jobId.substring(0, 6) : "unknown";
    page.drawText(`ID:${jobId}`, {
      x: x + placeholderWidth - 115,
      y: y + textAreaHeight/2 + 1,
      size: 6,
      font: helveticaFont,
      color: rgb(1, 1, 1)
    });
    
    // Draw quantity
    page.drawText(`Qty:${slot.quantity || 0}`, {
      x: x + placeholderWidth - 75,
      y: y + textAreaHeight/2 + 1,
      size: 6,
      font: helveticaFont,
      color: rgb(1, 1, 1)
    });
    
    // Draw front/back indicator
    page.drawText(slot.isBack ? `Back` : `Front`, {
      x: x + placeholderWidth - 38,
      y: y + textAreaHeight/2 + 1,
      size: 6,
      font: helveticaFont,
      color: rgb(1, 1, 1)
    });
  } catch (error) {
    console.error("Error drawing job info:", error);
  }
}

/**
 * Draw an empty placeholder
 */
function drawEmptyPlaceholder(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  font: any
): void {
  // Draw placeholder with light border
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.5,
    color: rgb(0.97, 0.97, 0.97)
  });
  
  // Draw text
  page.drawText("Empty", {
    x: x + width / 2 - 15,
    y: y + height / 2,
    size: 12,
    font,
    color: rgb(0.6, 0.6, 0.6)
  });
}

/**
 * Draw side information text
 */
function drawSideInfo(
  page: PDFPage,
  pageType: string,
  batchName: string,
  helveticaFont: any,
  helveticaBold: any
): void {
  try {
    // Format information
    const timestamp = new Date().toISOString().substring(0, 16).replace('T', ' ');
    const sideText = `${batchName} | ${pageType} | ${timestamp}`;
    
    // Left side text (rotated 90 degrees counterclockwise)
    const leftX = mmToPoints(5);
    const centerY = page.getHeight() / 2;
    
    // Use the correct rotation format
    page.drawText(sideText, {
      x: leftX,
      y: centerY,
      size: 8,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: { type: RotationTypes.Degrees, angle: -90 }
    });
    
    // Right side text (rotated 90 degrees clockwise)
    const rightX = page.getWidth() - mmToPoints(5);
    
    // Use the correct rotation format
    page.drawText(sideText, {
      x: rightX,
      y: centerY,
      size: 8,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: { type: RotationTypes.Degrees, angle: 90 }
    });
  } catch (error) {
    console.error("Error drawing side info:", error);
  }
}
