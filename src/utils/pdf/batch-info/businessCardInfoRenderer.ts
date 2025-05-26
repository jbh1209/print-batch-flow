
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
  
  // Very compact layout to prevent overflow
  const laminationType = jobs[0]?.lamination_type || 'none';
  const laminationText = `Lamination: ${laminationType.charAt(0).toUpperCase() + laminationType.slice(1)}`;
  
  // Position elements in a more compact horizontal layout
  const infoY = page.getHeight() - margin - 85; // Moved higher up
  
  // Lamination info - smaller and more compact
  page.drawRectangle({
    x: margin - 5,
    y: infoY,
    width: 110, // Further reduced width
    height: 18, // Further reduced height
    color: rgb(0.102, 0.122, 0.173),
  });
  
  page.drawText(laminationText, {
    x: margin,
    y: infoY + 5, // Adjusted for smaller rectangle
    size: 9, // Smaller font
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  // Total cards info - positioned inline to save space
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  
  page.drawText(`Total Cards: ${totalCards}`, {
    x: margin + 125, // Position to the right with less spacing
    y: infoY + 5,
    size: 9, // Smaller font to match
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  // Sheets required - positioned below with minimal spacing
  const actualSheetsRequired = sheetsRequired > 0 ? sheetsRequired : Math.ceil(totalCards / 24);
  console.log("Calculated sheets required:", actualSheetsRequired);
  
  const sheetsY = infoY - 25; // Reduced spacing
  
  page.drawRectangle({
    x: margin - 5,
    y: sheetsY,
    width: 140, // Reduced width
    height: 18, // Reduced height to match above
    color: rgb(0.102, 0.122, 0.173),
  });
  
  page.drawText(`Sheets Required: ${actualSheetsRequired}`, {
    x: margin,
    y: sheetsY + 5, // Adjusted for smaller rectangle
    size: 10, // Slightly larger for importance
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  console.log("Business card info positioning (ultra-compact):", {
    infoY,
    totalCardsY: infoY + 5,
    sheetsY
  });
}
