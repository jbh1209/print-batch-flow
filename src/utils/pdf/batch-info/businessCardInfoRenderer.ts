
import { PDFPage, rgb } from "pdf-lib";
import { Job } from "@/components/batches/types/BatchTypes";

export function drawBusinessCardInfo(
  page: PDFPage,
  jobs: Job[],
  margin: number,
  helveticaBold: any,
  helveticaFont: any,
  sheetsRequired: number
): void {
  // Draw lamination info background and text
  const laminationType = jobs[0]?.lamination_type || 'none';
  const laminationText = `Lamination: ${laminationType.charAt(0).toUpperCase() + laminationType.slice(1)}`;
  
  page.drawRectangle({
    x: margin - 5,
    y: page.getHeight() - margin - 75,
    width: 150,
    height: 30,
    color: rgb(0.102, 0.122, 0.173),
  });
  
  page.drawText(laminationText, {
    x: margin,
    y: page.getHeight() - margin - 60,
    size: 12,
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  
  page.drawText(`Total Cards: ${totalCards}`, {
    x: margin,
    y: page.getHeight() - margin - 90,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  // Calculate doubled sheets required and draw info
  const actualSheetsRequired = sheetsRequired > 0 ? sheetsRequired * 2 : Math.ceil(totalCards / 12);
  
  page.drawRectangle({
    x: margin - 5,
    y: page.getHeight() - margin - 125,
    width: 200,
    height: 30,
    color: rgb(0.102, 0.122, 0.173),
  });
  
  page.drawText(`Sheets Required: ${actualSheetsRequired}`, {
    x: margin,
    y: page.getHeight() - margin - 110,
    size: 14,
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
}
