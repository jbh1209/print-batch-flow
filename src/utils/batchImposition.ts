
import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Import our refactored helpers
import { mmToPoints } from "./pdf/pdfUnitHelpers";
import { calculateDimensions } from "./pdf/impositionDimensionsHelper";
import { drawBatchInfo, drawSideInfo } from "./pdf/impositionBatchInfoHelper";
import { drawCardGrid } from "./pdf/gridDrawingHelpers";
import { loadJobPDFs, createDuplicatedImpositionPDFs } from "./pdf/jobPdfLoader";

// Main function to generate the imposition sheet with improved error handling
export async function generateImpositionSheet(jobs: Job[]): Promise<Uint8Array> {
  console.log("Starting imposition sheet generation for", jobs.length, "jobs");
  
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
    
    // Generate a batch name for display - use a default if none provided
    const batchName = `DXB-BC-00001`; // Fixed batch name as a fallback
    
    console.log("Creating duplicated imposition PDFs...");
    // Create both front and back imposition sheets
    const { frontPDFs, backPDFs } = await createDuplicatedImpositionPDFs(jobs, 1);
    
    if (frontPDFs.length === 0) {
      console.error("No valid front PDFs were created for imposition");
    } else {
      console.log(`Created ${frontPDFs.length} front PDFs for imposition`);
    }
    
    console.log("Creating front page");
    // Generate front page
    let frontPage = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // Draw batch information at top (no rotation)
    drawBatchInfo(frontPage, jobs, helveticaFont, helveticaBold, "Front");
    
    // Draw side information (simple text)
    drawSideInfo(frontPage, jobs, helveticaFont, helveticaBold, batchName, "Front");
    
    console.log("Loading job PDFs...");
    // Load job PDFs for backup approach if needed
    const validJobPDFs = await loadJobPDFs(jobs);
    
    console.log("Drawing front grid...");
    // First try to use the frontPDFs array, fall back to validJobPDFs if needed
    if (frontPDFs.length > 0) {
      console.log("Drawing grid with front PDFs");
      drawCardGrid(frontPage, validJobPDFs, dimensions, helveticaFont, helveticaBold, frontPDFs);
    } else {
      console.log("Drawing grid with valid job PDFs");
      drawCardGrid(frontPage, validJobPDFs, dimensions, helveticaFont, helveticaBold);
    }
    
    // If we have back pages, create a back imposition sheet
    if (backPDFs.length > 0) {
      console.log("Creating back page");
      let backPage = pdfDoc.addPage([pageWidth, pageHeight]);
      
      // Draw batch information for back page
      drawBatchInfo(backPage, jobs, helveticaFont, helveticaBold, "Back");
      
      // Draw side information
      drawSideInfo(backPage, jobs, helveticaFont, helveticaBold, batchName, "Back");
      
      console.log("Drawing back grid...");
      drawCardGrid(backPage, validJobPDFs, dimensions, helveticaFont, helveticaBold, backPDFs);
    }
    
    console.log("Serializing PDF document...");
    // Serialize the PDFDocument to bytes
    return await pdfDoc.save();
  } catch (error) {
    console.error("Error generating imposition sheet:", error);
    throw error;
  }
}
