
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
  console.log("=== BUSINESS CARD INFO RENDERER START ===");
  console.log("Received sheetsRequired parameter:", sheetsRequired);
  console.log("Type of sheetsRequired:", typeof sheetsRequired);
  console.log("Is sheetsRequired falsy?", !sheetsRequired);
  console.log("Is sheetsRequired > 0?", sheetsRequired > 0);
  
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
  console.log("Total cards calculated:", totalCards);
  
  page.drawText(`Total Cards: ${totalCards}`, {
    x: margin,
    y: page.getHeight() - margin - 90,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  // CRITICAL CHANGE: Always use the passed sheetsRequired value directly
  // If it's 0 or undefined, calculate as fallback
  let displaySheetsRequired;
  if (sheetsRequired && sheetsRequired > 0) {
    displaySheetsRequired = sheetsRequired;
    console.log("Using passed sheetsRequired value:", displaySheetsRequired);
  } else {
    displaySheetsRequired = Math.ceil(totalCards / 24);
    console.log("sheetsRequired was", sheetsRequired, "so calculated fallback:", displaySheetsRequired);
  }
  
  console.log("FINAL sheets required value to display:", displaySheetsRequired);
  
  page.drawRectangle({
    x: margin - 5,
    y: page.getHeight() - margin - 125,
    width: 200,
    height: 30,
    color: rgb(0.102, 0.122, 0.173),
  });
  
  const sheetsText = `Sheets Required: ${displaySheetsRequired}`;
  console.log("Drawing text on PDF:", sheetsText);
  
  page.drawText(sheetsText, {
    x: margin,
    y: page.getHeight() - margin - 110,
    size: 14,
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  console.log("=== BUSINESS CARD INFO RENDERER COMPLETE ===");
}
