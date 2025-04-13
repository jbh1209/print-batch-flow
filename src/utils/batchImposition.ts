
import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Import our refactored helpers
import { mmToPoints } from "./pdf/pdfUnitHelpers";
import { calculateDimensions } from "./pdf/impositionDimensionsHelper";
import { drawBatchInfo } from "./pdf/impositionBatchInfoHelper";
import { drawCardGrid } from "./pdf/gridDrawingHelpers";
import { loadJobPDFs } from "./pdf/jobPdfLoader";

// Main function to generate the imposition sheet
export async function generateImpositionSheet(jobs: Job[]): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Add page with custom dimensions (320mm x 455mm)
  const pageWidth = mmToPoints(320);
  const pageHeight = mmToPoints(455);
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Get fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Define dimensions
  const dimensions = calculateDimensions(pageWidth, pageHeight);
  
  // Add batch information at the top of the sheet
  drawBatchInfo(page, jobs, helveticaFont, helveticaBold);
  
  // Load job PDFs
  const validJobPDFs = await loadJobPDFs(jobs);
  
  // Draw grid with job cards
  drawCardGrid(page, validJobPDFs, dimensions, helveticaFont, helveticaBold);
  
  // Serialize the PDFDocument to bytes
  return await pdfDoc.save();
}
