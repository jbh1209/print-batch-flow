
import { PDFDocument, PDFPage, rgb, StandardFonts, RotationTypes } from "pdf-lib";
import { mmToPoints } from "./pdfUnitHelpers";
import { ImpositionSlot } from "./ImpositionEngine"; // Fixed import path

export async function drawImpositionGrid(
  pdfDoc: PDFDocument,
  page: PDFPage,
  slots: ImpositionSlot[],
  gridDimensions: ReturnType<typeof import("./gridDimensions").calculateGridDimensions>,
  pageType: "Front" | "Back",
  batchName: string
): Promise<void> {
  const {
    placeholderWidth,
    placeholderHeight,
    columns,
    rows,
    horizontalMargin,
    verticalMargin,
    textAreaHeight
  } = gridDimensions;

  // Load fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Draw side information
  drawSideInfo(page, pageType, batchName, helveticaFont, helveticaBold);
  
  // Create slots array with placeholders for all positions
  const filledSlots = new Array(columns * rows).fill(null);
  
  // Fill in the slots we have content for
  for (const slot of slots) {
    if (slot.position < filledSlots.length) {
      filledSlots[slot.position] = slot;
    }
  }
  
  // Draw each position in the grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const position = row * columns + col;
      const slot = filledSlots[position];
      
      // Calculate position
      const x = horizontalMargin + col * placeholderWidth;
      const y = page.getHeight() - verticalMargin - (row + 1) * placeholderHeight;
      
      if (slot) {
        // We have content for this slot
        await drawSlotWithContent(
          pdfDoc,
          page,
          slot,
          x,
          y,
          placeholderWidth,
          placeholderHeight,
          textAreaHeight,
          helveticaFont,
          helveticaBold
        );
      } else {
        // Draw empty placeholder
        drawEmptyPlaceholder(
          page,
          x,
          y,
          placeholderWidth,
          placeholderHeight,
          helveticaFont
        );
      }
    }
  }
}

async function drawSlotWithContent(
  pdfDoc: PDFDocument,
  page: PDFPage,
  slot: ImpositionSlot,
  x: number,
  y: number,
  placeholderWidth: number,
  placeholderHeight: number,
  textAreaHeight: number,
  helveticaFont: any,
  helveticaBold: any
): Promise<void> {
  try {
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
          const availableHeight = placeholderHeight - textAreaHeight;
          
          // Calculate scale factors with margins
          const scaleX = (placeholderWidth - mmToPoints(6)) / originalWidth;
          const scaleY = (availableHeight - mmToPoints(6)) / originalHeight;
          
          // Use the smaller scale factor
          const scale = Math.min(scaleX, scaleY);
          
          // Calculate dimensions and position
          const scaledWidth = originalWidth * scale;
          const scaledHeight = originalHeight * scale;
          
          // Center within placeholder
          const embedX = x + (placeholderWidth - scaledWidth) / 2;
          const embedY = y + textAreaHeight + (availableHeight - scaledHeight) / 2;
          
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
        x: x + placeholderWidth / 2 - 50,
        y: y + placeholderHeight / 2,
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
      placeholderWidth,
      textAreaHeight,
      helveticaFont,
      helveticaBold
    );
  } catch (error) {
    console.error(`Error drawing slot ${slot.position}:`, error);
  }
}

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
