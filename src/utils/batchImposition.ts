
import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Import our refactored helpers
import { mmToPoints } from "./pdf/pdfUnitHelpers";
import { calculateDimensions } from "./pdf/impositionDimensionsHelper";
import { drawBatchInfo } from "./pdf/impositionBatchInfoHelper";
import { drawCardGrid } from "./pdf/gridDrawingHelpers";
import { loadJobPDFs, createDuplicatedImpositionPDFs } from "./pdf/jobPdfLoader";

// Main function to generate the imposition sheet
export async function generateImpositionSheet(jobs: Job[]): Promise<Uint8Array> {
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
  
  // Generate front page
  let frontPage = pdfDoc.addPage([pageWidth, pageHeight]);
  drawBatchInfo(frontPage, jobs, helveticaFont, helveticaBold, "Front");
  
  // Load job PDFs and draw front grid
  const validJobPDFs = await loadJobPDFs(jobs);
  drawCardGrid(frontPage, validJobPDFs, dimensions, helveticaFont, helveticaBold, frontPDFs);
  
  // If we have back pages, create a back imposition sheet
  if (backPDFs.length > 0) {
    let backPage = pdfDoc.addPage([pageWidth, pageHeight]);
    drawBatchInfo(backPage, jobs, helveticaFont, helveticaBold, "Back");
    drawCardGrid(backPage, validJobPDFs, dimensions, helveticaFont, helveticaBold, backPDFs);
  }
  
  // Serialize the PDFDocument to bytes
  return await pdfDoc.save();
}
