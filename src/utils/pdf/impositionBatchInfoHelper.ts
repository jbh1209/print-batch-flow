
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
  const laminationType = jobs[0]?.lamination_type || 'none';
  const formattedLamination = laminationType.charAt(0).toUpperCase() + laminationType.slice(1);
  
  page.drawText(`Business Card Imposition Sheet (${pageType}) - ${formattedLamination} Lamination`, {
    x: mmToPoints(10),
    y: page.getHeight() - mmToPoints(10),
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  
  page.drawText(`Total Jobs: ${jobs.length} | Total Cards: ${totalCards} | Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, {
    x: mmToPoints(10),
    y: page.getHeight() - mmToPoints(20),
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
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
  // Calculate total number of cards for display
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  const laminationType = jobs[0]?.lamination_type || 'none';
  const formattedLamination = laminationType.charAt(0).toUpperCase() + laminationType.slice(1);
  
  // Create the side text content
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');
  const sideText = `${batchName} Sheet (${pageType}) - ${formattedLamination} Lamination | Total Jobs: ${jobs.length} | Total Cards: ${totalCards} | Generated: ${timestamp}`;
  
  // Draw the text directly without rotation transformation to avoid PDF operator errors
  page.drawText(sideText, {
    x: mmToPoints(20),
    y: mmToPoints(10),
    size: 8,
    font: helveticaBold,
    color: rgb(0, 0, 0),
    rotate: { type: 'degrees', angle: 90 }
  });
}
