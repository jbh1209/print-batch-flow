
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
  margin: number,
  sheetsRequired: number = 0 // Allow passing in optimized sheet count
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
  
  // If sheetsRequired is provided, use it, otherwise calculate
  const calculatedSheetsRequired = sheetsRequired || Math.ceil(totalCards / 24);
  
  page.drawText(`Total Cards: ${totalCards}`, {
    x: margin,
    y: page.getHeight() - margin - 70,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  page.drawText(`Sheets Required: ${calculatedSheetsRequired}`, {
    x: margin,
    y: page.getHeight() - margin - 90,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  // Add a note about optimization
  if (sheetsRequired > 0) {
    page.drawText(`Note: Sheet count optimized based on job quantities and slot allocation`, {
      x: margin,
      y: page.getHeight() - margin - 110,
      size: 10,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4)
    });
  }
}
