
import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Import our refactored helpers
import { mmToPoints } from "./pdf/pdfUnitHelpers";
import { calculateDimensions } from "./pdf/impositionDimensionsHelper";
import { drawSideInfo } from "./pdf/impositionBatchInfoHelper";
import { drawCardGrid } from "./pdf/gridDrawingHelpers";
import { createImpositionLayout } from "./pdf/jobPdfLoader";

// Main function to generate the imposition sheet with completely rewritten logic
export async function generateImpositionSheet(jobs: Job[], batchName: string = ""): Promise<Uint8Array> {
  console.log("-------------------------");
  console.log("STARTING IMPOSITION SHEET GENERATION");
  console.log("Jobs: ", jobs.length, "Batch Name:", batchName);
  console.log("-------------------------");
  
  try {
    // Validate input
    if (!jobs || jobs.length === 0) {
      console.error("No jobs provided for imposition sheet generation");
      throw new Error("No jobs provided for imposition sheet generation");
    }
    
    // Create a new PDF document
    console.log("Creating new PDF document");
    const pdfDoc = await PDFDocument.create();
    
    // Add page with custom dimensions (320mm x 455mm)
    const pageWidth = mmToPoints(320);
    const pageHeight = mmToPoints(455);
    
    console.log("Getting fonts...");
    // Get fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Define dimensions
    const dimensions = calculateDimensions(pageWidth, pageHeight);
    
    // Use provided batch name directly
    const actualBatchName = batchName || generateDefaultBatchName();
    console.log("Final batch name for display:", actualBatchName);
    
    console.log("Creating imposition layout...");
    // Create both front and back imposition sheets
    // Use 24 slots per sheet (3x8 grid)
    const { frontPositions, backPositions } = await createImpositionLayout(jobs, 24);
    
    console.log(`Layout created - Front positions: ${frontPositions.length}, Back positions: ${backPositions.length}`);
    
    // Create front page
    console.log("Creating front page...");
    let frontPage = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // Draw side information (side text)
    drawSideInfo(frontPage, jobs, helveticaFont, helveticaBold, actualBatchName, "Front");
    
    console.log("Drawing front grid...");
    // Use the frontPositions array for job placement
    await drawCardGrid(frontPage, dimensions, helveticaFont, helveticaBold, frontPositions);
    
    // If we have back pages, create a back imposition sheet
    if (backPositions.length > 0) {
      console.log("Creating back page...");
      let backPage = pdfDoc.addPage([pageWidth, pageHeight]);
      
      // Draw side information
      drawSideInfo(backPage, jobs, helveticaFont, helveticaBold, actualBatchName, "Back");
      
      console.log("Drawing back grid...");
      await drawCardGrid(backPage, dimensions, helveticaFont, helveticaBold, backPositions);
    } else if (jobs.some(job => job.double_sided)) {
      // Create a back page anyway if any jobs are double-sided
      console.log("Creating back page for double-sided jobs");
      let backPage = pdfDoc.addPage([pageWidth, pageHeight]);
      
      // Draw side information
      drawSideInfo(backPage, jobs, helveticaFont, helveticaBold, actualBatchName, "Back");
      
      console.log("Drawing back grid with placeholder...");
      await drawCardGrid(backPage, dimensions, helveticaFont, helveticaBold);
    }
    
    console.log("Serializing PDF document...");
    // Serialize the PDFDocument to bytes
    return await pdfDoc.save();
  } catch (error) {
    console.error("Error generating imposition sheet:", error);
    
    // Create a simple error PDF as a fallback
    try {
      const errorPdf = await PDFDocument.create();
      const errorPage = errorPdf.addPage([mmToPoints(320), mmToPoints(455)]);
      const font = await errorPdf.embedFont(StandardFonts.Helvetica);
      const boldFont = await errorPdf.embedFont(StandardFonts.HelveticaBold);
      
      errorPage.drawText("Error Generating Imposition Sheet", {
        x: 50,
        y: errorPage.getHeight() - 50,
        size: 24,
        font: boldFont
      });
      
      errorPage.drawText(`Error: ${error instanceof Error ? error.message : "Unknown error"}`, {
        x: 50,
        y: errorPage.getHeight() - 100,
        size: 12,
        font,
        color: rgb(0.8, 0, 0)
      });
      
      errorPage.drawText("Please check that all job PDFs are valid and accessible.", {
        x: 50,
        y: errorPage.getHeight() - 150,
        size: 12,
        font
      });
      
      return await errorPdf.save();
    } catch (fallbackError) {
      console.error("Error creating fallback error PDF:", fallbackError);
      throw error; // Re-throw the original error if we can't create a fallback
    }
  }
}

// Helper function to generate a default batch name if none is provided
function generateDefaultBatchName(): string {
  // Format as DXB-BC-YYMMDD-sequence
  const today = new Date();
  const year = today.getFullYear().toString().slice(2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `DXB-BC-${year}${month}${day}`;
}
