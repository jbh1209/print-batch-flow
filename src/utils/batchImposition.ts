import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Import our refactored helpers
import { mmToPoints } from "./pdf/pdfUnitHelpers";
import { calculateDimensions } from "./pdf/impositionDimensionsHelper";
import { drawBatchInfo, drawSideInfo } from "./pdf/impositionBatchInfoHelper";
import { drawCardGrid } from "./pdf/gridDrawingHelpers";
import { loadJobPDFs, createDuplicatedImpositionPDFs } from "./pdf/jobPdfLoader";

// Main function to generate the imposition sheet with improved error handling
export async function generateImpositionSheet(jobs: Job[], batchName: string = ""): Promise<Uint8Array> {
  console.log("Starting imposition sheet generation for", jobs.length, "jobs");
  console.log("Using batch name:", batchName);
  
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
    
    // Use provided batch name directly without generating a default
    // This ensures the batch name from the database is used on the imposition sheet
    const actualBatchName = batchName || generateDefaultBatchName();
    console.log("Final batch name for display:", actualBatchName);
    
    // Adjust the vertical margin to give more space at top
    dimensions.verticalMargin = mmToPoints(25); // Reduced from 35 to 25 since we removed the header
    
    console.log("Loading job PDFs as backup...");
    // Load job PDFs first - this ensures we have all PDFs loaded before creating pages
    const validJobPDFs = await loadJobPDFs(jobs);
    console.log(`Loaded ${validJobPDFs.length} job PDFs as backup`);
    
    console.log("Creating duplicated imposition PDFs...");
    // Create both front and back imposition sheets
    // Use 24 slots per sheet (3x8 grid)
    const { frontPDFs, backPDFs } = await createDuplicatedImpositionPDFs(jobs, 24);
    
    console.log(`Front PDFs count: ${frontPDFs.length}, Back PDFs count: ${backPDFs.length}`);
    
    // Create front page
    console.log("Creating front page");
    let frontPage = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // REMOVED: Draw batch information at top (no rotation) - removed per user request
    // Just keeping the side information for reference
    
    // Draw side information (side text) with correct batch name
    drawSideInfo(frontPage, jobs, helveticaFont, helveticaBold, actualBatchName, "Front");
    
    console.log("Drawing front grid...");
    // First try to use the frontPDFs array - this is crucial for job duplication
    drawCardGrid(frontPage, validJobPDFs, dimensions, helveticaFont, helveticaBold, frontPDFs);
    
    // If we have back pages, create a back imposition sheet
    if (backPDFs.length > 0) {
      console.log("Creating back page");
      let backPage = pdfDoc.addPage([pageWidth, pageHeight]);
      
      // REMOVED: Draw batch information for back page 
      // Just keeping the side information for reference
      
      // Draw side information with correct batch name
      drawSideInfo(backPage, jobs, helveticaFont, helveticaBold, actualBatchName, "Back");
      
      console.log("Drawing back grid...");
      drawCardGrid(backPage, validJobPDFs, dimensions, helveticaFont, helveticaBold, backPDFs);
    } else if (jobs.some(job => job.double_sided)) {
      // Create a back page anyway if any jobs are double-sided
      console.log("Creating back page for double-sided jobs");
      let backPage = pdfDoc.addPage([pageWidth, pageHeight]);
      
      // REMOVED: Draw batch information for back page
      // Just keeping the side information for reference
      
      // Draw side information with correct batch name
      drawSideInfo(backPage, jobs, helveticaFont, helveticaBold, actualBatchName, "Back");
      
      console.log("Drawing back grid with placeholder...");
      drawCardGrid(backPage, validJobPDFs, dimensions, helveticaFont, helveticaBold);
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
      
      // List jobs with URLs
      let y = errorPage.getHeight() - 200;
      for (const job of jobs) {
        errorPage.drawText(`Job ${job.id}: ${job.name || "Unnamed"} - ${job.pdf_url ? "Has URL" : "No URL"}`, {
          x: 50,
          y,
          size: 10,
          font
        });
        y -= 15;
      }
      
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
