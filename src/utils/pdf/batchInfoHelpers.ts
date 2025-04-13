
import { PDFPage, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { format } from "date-fns";

// Function to draw batch information
export function drawBatchInfo(
  page: PDFPage,
  batchName: string,
  jobs: Job[],
  helveticaFont: any,
  helveticaBold: any,
  margin: number
): void {
  // Draw batch header
  page.drawText(`Batch Overview: ${batchName}`, {
    x: margin,
    y: page.getHeight() - margin,
    size: 18,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  page.drawText(`Created: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, {
    x: margin,
    y: page.getHeight() - margin - 30,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  const laminationType = jobs[0]?.lamination_type || 'none';
  page.drawText(`Lamination: ${laminationType.charAt(0).toUpperCase() + laminationType.slice(1)}`, {
    x: margin,
    y: page.getHeight() - margin - 50,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  const sheetsRequired = Math.ceil(totalCards / 24);
  
  page.drawText(`Total Cards: ${totalCards}`, {
    x: margin,
    y: page.getHeight() - margin - 70,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  page.drawText(`Sheets Required: ${sheetsRequired}`, {
    x: margin,
    y: page.getHeight() - margin - 90,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
}
