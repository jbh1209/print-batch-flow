
import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Import our refactored helpers
import { mmToPoints } from "./pdf/pdfUnitHelpers";
import { calculateDimensions } from "./pdf/impositionDimensionsHelper";
import { drawBatchInfo, drawSideInfo } from "./pdf/impositionBatchInfoHelper";
import { drawCardGrid } from "./pdf/gridDrawingHelpers";
import { loadJobPDFs, createDuplicatedImpositionPDFs } from "./pdf/jobPdfLoader";

// Main function to generate the imposition sheet
export async function generateImpositionSheet(jobs: Job[]): Promise<Uint8Array> {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add page with custom dimensions (320mm x 455mm)
    const pageWidth = mmToPoints(320);
    const pageHeight = mmToPoints(455);
    
    // Create both front and back imposition sheets
    const { frontPDFs, backPDFs } = await createDuplicatedImpositionPDFs(jobs, 1);
    
    // Get fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Define dimensions
    const dimensions = calculateDimensions(pageWidth, pageHeight);
    
    // Generate a batch name for display - use a default if none provided
    const batchName = `DXB-BC-00001`; // Fixed batch name as a fallback
    
    // Generate front page
    let frontPage = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // Draw batch information at top (no rotation)
    drawBatchInfo(frontPage, jobs, helveticaFont, helveticaBold, "Front");
    
    // Draw side information (simple text, no rotation transform)
    drawSideInfo(frontPage, jobs, helveticaFont, helveticaBold, batchName, "Front");
    
    // Load job PDFs and draw front grid
    const validJobPDFs = await loadJobPDFs(jobs);
    drawCardGrid(frontPage, validJobPDFs, dimensions, helveticaFont, helveticaBold, frontPDFs);
    
    // If we have back pages, create a back imposition sheet
    if (backPDFs.length > 0) {
      let backPage = pdfDoc.addPage([pageWidth, pageHeight]);
      
      // Draw batch information for back page (no rotation)
      drawBatchInfo(backPage, jobs, helveticaFont, helveticaBold, "Back");
      
      // Draw side information (simple text, no rotation transform)
      drawSideInfo(backPage, jobs, helveticaFont, helveticaBold, batchName, "Back");
      
      drawCardGrid(backPage, validJobPDFs, dimensions, helveticaFont, helveticaBold, backPDFs);
    }
    
    // Serialize the PDFDocument to bytes
    return await pdfDoc.save();
  } catch (error) {
    console.error("Error generating imposition sheet:", error);
    throw error;
  }
}
