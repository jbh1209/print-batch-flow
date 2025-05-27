
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
  console.log("Is sheetsRequired truthy?", !!sheetsRequired);
  console.log("Is sheetsRequired > 0?", sheetsRequired > 0);
  console.log("Jobs array length:", jobs.length);
  
  // Draw lamination info background and text - LIGHTER BLUE COLOR
  const laminationType = jobs[0]?.lamination_type || 'none';
  const laminationText = `Lamination: ${laminationType.charAt(0).toUpperCase() + laminationType.slice(1)}`;
  
  console.log("Drawing lamination rectangle with LIGHTER blue color");
  page.drawRectangle({
    x: margin - 5,
    y: page.getHeight() - margin - 75,
    width: 150,
    height: 30,
    color: rgb(0.2, 0.3, 0.6), // LIGHTER blue color
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
  
  // ENHANCED DEBUGGING FOR SHEETS REQUIRED
  console.log("=== SHEETS REQUIRED PROCESSING ===");
  console.log("Raw sheetsRequired parameter:", sheetsRequired);
  console.log("sheetsRequired === undefined:", sheetsRequired === undefined);
  console.log("sheetsRequired === null:", sheetsRequired === null);
  console.log("sheetsRequired === 0:", sheetsRequired === 0);
  
  // Use the passed sheetsRequired value directly - no fallback calculation
  let displaySheetsRequired = sheetsRequired;
  
  // Only calculate fallback if sheetsRequired is undefined, null, or 0
  if (!sheetsRequired || sheetsRequired <= 0) {
    displaySheetsRequired = Math.ceil(totalCards / 24);
    console.log("sheetsRequired was falsy, calculated fallback:", displaySheetsRequired);
  } else {
    console.log("Using passed sheetsRequired value:", displaySheetsRequired);
  }
  
  console.log("FINAL sheets required value to display:", displaySheetsRequired);
  
  // Add timestamp to force cache busting
  const timestamp = Date.now();
  console.log("Cache-busting timestamp:", timestamp);
  
  // Draw sheets required rectangle - LIGHTER BLUE COLOR AND LARGER
  console.log("Drawing sheets required rectangle with LIGHTER blue color");
  page.drawRectangle({
    x: margin - 5,
    y: page.getHeight() - margin - 125,
    width: 250, // INCREASED width for better visibility
    height: 35, // INCREASED height for better visibility
    color: rgb(0.2, 0.3, 0.6), // LIGHTER blue color (same as lamination)
  });
  
  const sheetsText = `Sheets Required: ${displaySheetsRequired}`;
  console.log("Drawing text on PDF:", sheetsText);
  console.log("Text position - x:", margin, "y:", page.getHeight() - margin - 105);
  
  page.drawText(sheetsText, {
    x: margin,
    y: page.getHeight() - margin - 105, // ADJUSTED for larger rectangle
    size: 16, // INCREASED font size for better visibility
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  console.log("=== BUSINESS CARD INFO RENDERER COMPLETE ===");
  console.log("Successfully rendered sheets required:", displaySheetsRequired);
}
