
import { PDFPage, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";

export function drawBusinessCardInfo(
  page: PDFPage,
  jobs: Job[],
  margin: number,
  helveticaBold: any,
  helveticaFont: any,
  sheetsRequired: number
): void {
  console.log("Drawing business card info - jobs count:", jobs.length);
  console.log("Sheets required parameter:", sheetsRequired);
  console.log("First job sample:", jobs[0]);
  
  // Draw lamination info background and text - positioned consistently
  const laminationType = jobs[0]?.lamination_type || 'none';
  const laminationText = `Lamination: ${laminationType.charAt(0).toUpperCase() + laminationType.slice(1)}`;
  
  // Position lamination info at consistent location
  const laminationY = page.getHeight() - margin - 80;
  
  page.drawRectangle({
    x: margin - 5,
    y: laminationY,
    width: 150,
    height: 25,
    color: rgb(0.102, 0.122, 0.173),
  });
  
  page.drawText(laminationText, {
    x: margin,
    y: laminationY + 8,
    size: 12,
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  // Total cards info - positioned below lamination
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  
  page.drawText(`Total Cards: ${totalCards}`, {
    x: margin,
    y: laminationY - 25,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  // Display the sheets required prominently - positioned below total cards
  const actualSheetsRequired = sheetsRequired > 0 ? sheetsRequired : Math.ceil(totalCards / 24);
  console.log("Calculated sheets required:", actualSheetsRequired);
  
  const sheetsY = laminationY - 50;
  
  page.drawRectangle({
    x: margin - 5,
    y: sheetsY,
    width: 200,
    height: 25,
    color: rgb(0.102, 0.122, 0.173),
  });
  
  page.drawText(`Sheets Required: ${actualSheetsRequired}`, {
    x: margin,
    y: sheetsY + 8,
    size: 14,
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  console.log("Business card info positioning:", {
    laminationY,
    totalCardsY: laminationY - 25,
    sheetsY
  });
}
