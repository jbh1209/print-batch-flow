
import { Job } from "@/components/business-cards/JobsTable";
import { format } from "date-fns";
import { rgb } from "pdf-lib";
import { mmToPoints } from "./pdfUnitHelpers";

// Draw batch information at the top of the sheet
export function drawBatchInfo(
  page: any, 
  jobs: Job[], 
  helveticaFont: any, 
  helveticaBold: any,
  pageType: string = "Front"
) {
  try {
    // Get lamination type with proper null checks and default
    let laminationType = 'none';
    if (jobs && jobs.length > 0 && jobs[0] && jobs[0].lamination_type) {
      laminationType = jobs[0].lamination_type;
    }
    
    const formattedLamination = laminationType.charAt(0).toUpperCase() + laminationType.slice(1);
    
    page.drawText(`Business Card Imposition Sheet (${pageType}) - ${formattedLamination} Lamination`, {
      x: mmToPoints(10),
      y: page.getHeight() - mmToPoints(10),
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });
    
    // Calculate total with null check
    const totalCards = jobs.reduce((sum, job) => sum + (job.quantity || 0), 0);
    
    page.drawText(`Total Jobs: ${jobs.length} | Total Cards: ${totalCards} | Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, {
      x: mmToPoints(10),
      y: page.getHeight() - mmToPoints(20),
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    });
  } catch (error) {
    console.error("Error drawing batch info:", error);
  }
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
    
    // Create the side text content
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');
    const sideText = `${batchName} Sheet (${pageType}) - ${formattedLamination} Lamination | Jobs: ${jobs.length} | Cards: ${totalCards} | ${timestamp}`;
    
    // Draw left side text (rotated 90 degrees counterclockwise)
    page.drawText(sideText, {
      x: mmToPoints(5),
      y: page.getHeight() / 2,
      size: 8,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: {
        angle: Math.PI * 1.5, // 270 degrees (90 degrees counterclockwise)
      }
    });
    
    // Draw right side text (rotated 90 degrees clockwise)
    page.drawText(sideText, {
      x: page.getWidth() - mmToPoints(5),
      y: page.getHeight() / 2,
      size: 8,
      font: helveticaBold,
      color: rgb(0, 0, 0),
      rotate: {
        angle: Math.PI / 2, // 90 degrees (90 degrees clockwise)
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
