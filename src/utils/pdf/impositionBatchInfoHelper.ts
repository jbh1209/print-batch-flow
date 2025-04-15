
import { Job } from "@/components/business-cards/JobsTable";
import { format } from "date-fns";
import { rgb } from "pdf-lib";
import { mmToPoints } from "./pdfUnitHelpers";

// Draw batch information at the top of the sheet
export function drawBatchInfo() {
  // Completely removed to prevent interference
  console.log("Header text drawing removed to prevent interference");
}

// Draw vertical side information text for the imposition sheet
export function drawSideInfo(
  page: any,
  jobs: Job[],
  helveticaFont: any,
  helveticaBold: any,
  batchName: string,
  pageType: string = "Front"
) {
  try {
    // Calculate total number of cards for display with null check
    const totalCards = jobs.reduce((sum, job) => sum + (job.quantity || 0), 0);
    
    // Get lamination type with proper null checks
    let laminationType = 'none';
    if (jobs && jobs.length > 0 && jobs[0] && jobs[0].lamination_type) {
      laminationType = jobs[0].lamination_type;
    }
    
    const formattedLamination = laminationType.charAt(0).toUpperCase() + laminationType.slice(1);
    
    // Use the provided batch name directly - do not modify it
    const formattedBatchName = batchName;
    
    // Create the side text content
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');
    const sideText = `${formattedBatchName} | ${pageType} | ${formattedLamination} | Jobs: ${jobs.length} | Cards: ${totalCards} | ${timestamp}`;
    
    // Draw left side text (rotated 90 degrees counterclockwise)
    const leftX = mmToPoints(5);
    const centerY = page.getHeight() / 2;
    
    page.drawText(sideText, {
      x: leftX,
      y: centerY,
      size: 8,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: {
        type: 'degrees',
        angle: 270,
        origin: { x: leftX, y: centerY }
      }
    });
    
    // Draw right side text (rotated 90 degrees clockwise)
    const rightX = page.getWidth() - mmToPoints(5);
    
    page.drawText(sideText, {
      x: rightX,
      y: centerY,
      size: 8,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: {
        type: 'degrees',
        angle: 90,
        origin: { x: rightX, y: centerY }
      }
    });
  } catch (error) {
    console.error("Error drawing side info:", error);
    
    // Fallback to simpler drawing without rotation
    try {
      page.drawText("Business Card Imposition Sheet", {
        x: mmToPoints(10),
        y: mmToPoints(10),
        size: 8,
        font: helveticaBold,
        color: rgb(0, 0, 0)
      });
    } catch (fallbackError) {
      console.error("Error in fallback side info drawing:", fallbackError);
    }
  }
}
