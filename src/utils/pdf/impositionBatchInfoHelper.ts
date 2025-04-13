
import { Job } from "@/components/business-cards/JobsTable";
import { format } from "date-fns";
import { rgb } from "pdf-lib";
import { mmToPoints } from "./pdfUnitHelpers";

// Draw batch information at the top of the sheet
export function drawBatchInfo(
  page: any, 
  jobs: Job[], 
  helveticaFont: any, 
  helveticaBold: any
) {
  const laminationType = jobs[0]?.lamination_type || 'none';
  const formattedLamination = laminationType.charAt(0).toUpperCase() + laminationType.slice(1);
  
  page.drawText(`Business Card Imposition Sheet - ${formattedLamination} Lamination`, {
    x: mmToPoints(10),
    y: page.getHeight() - mmToPoints(10),
    size: 12,
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
