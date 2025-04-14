
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
    const sideText = `${batchName} Sheet (${pageType}) - ${formattedLamination} Lamination | Total Jobs: ${jobs.length} | Total Cards: ${totalCards} | Generated: ${timestamp}`;
    
    // Draw the side text directly (without using rotation operator directly)
    // Instead, use the simple rotation option that is more PDF-lib compatible
    page.drawText(sideText, {
      x: mmToPoints(10),
      y: mmToPoints(10),
      size: 8,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });
  } catch (error) {
    console.error("Error drawing side info:", error);
  }
}
