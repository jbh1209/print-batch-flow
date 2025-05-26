
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
  
  // More compact layout with smaller elements
  const laminationType = jobs[0]?.lamination_type || 'none';
  const laminationText = `Lamination: ${laminationType.charAt(0).toUpperCase() + laminationType.slice(1)}`;
  
  // Position lamination info more compactly
  const laminationY = page.getHeight() - margin - 70; // Moved up
  
  page.drawRectangle({
    x: margin - 5,
    y: laminationY,
    width: 130, // Reduced width
    height: 20, // Reduced height
    color: rgb(0.102, 0.122, 0.173),
  });
  
  page.drawText(laminationText, {
    x: margin,
    y: laminationY + 6, // Adjusted for smaller rectangle
    size: 10, // Smaller font
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  // Total cards info - positioned inline to save space
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  
  page.drawText(`Total Cards: ${totalCards}`, {
    x: margin + 150, // Position to the right of lamination
    y: laminationY + 6,
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  // Display the sheets required more compactly
  const actualSheetsRequired = sheetsRequired > 0 ? sheetsRequired : Math.ceil(totalCards / 24);
  console.log("Calculated sheets required:", actualSheetsRequired);
  
  const sheetsY = laminationY - 30; // Reduced spacing
  
  page.drawRectangle({
    x: margin - 5,
    y: sheetsY,
    width: 160, // Reduced width
    height: 20, // Reduced height
    color: rgb(0.102, 0.122, 0.173),
  });
  
  page.drawText(`Sheets Required: ${actualSheetsRequired}`, {
    x: margin,
    y: sheetsY + 6, // Adjusted for smaller rectangle
    size: 12, // Slightly smaller
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  console.log("Business card info positioning (compact):", {
    laminationY,
    totalCardsY: laminationY + 6,
    sheetsY
  });
}
