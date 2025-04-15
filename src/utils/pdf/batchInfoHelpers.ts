
import { PDFPage, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { format } from "date-fns";

export function drawBatchInfo(
  page: PDFPage,
  batchName: string,
  jobs: Job[],
  helveticaFont: any,
  helveticaBold: any,
  margin: number,
  sheetsRequired: number = 0
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
  
  // Draw lamination info with background
  const laminationType = jobs[0]?.lamination_type || 'none';
  const laminationText = `Lamination: ${laminationType.charAt(0).toUpperCase() + laminationType.slice(1)}`;
  
  // Draw background box for lamination
  page.drawRectangle({
    x: margin - 5,
    y: page.getHeight() - margin - 75,
    width: 150,
    height: 30,
    color: rgb(0.102, 0.122, 0.173), // Dark purple background
  });
  
  // Draw lamination text in white
  page.drawText(laminationText, {
    x: margin,
    y: page.getHeight() - margin - 60,
    size: 12,
    font: helveticaBold,
    color: rgb(1, 1, 1) // White text
  });
  
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  
  page.drawText(`Total Cards: ${totalCards}`, {
    x: margin,
    y: page.getHeight() - margin - 90,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  // Calculate doubled sheets required
  const actualSheetsRequired = sheetsRequired > 0 ? sheetsRequired * 2 : Math.ceil(totalCards / 12);
  
  // Draw background box for sheets required
  page.drawRectangle({
    x: margin - 5,
    y: page.getHeight() - margin - 125,
    width: 200,
    height: 30,
    color: rgb(0.102, 0.122, 0.173), // Dark purple background
  });
  
  // Draw sheets required text in white
  page.drawText(`Sheets Required: ${actualSheetsRequired}`, {
    x: margin,
    y: page.getHeight() - margin - 110,
    size: 14,
    font: helveticaBold,
    color: rgb(1, 1, 1) // White text
  });
}
