
import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { 
  addNewPage,
  calculateColumnStarts,
  drawTableHeader,
  addContinuationPage,
  drawFooter 
} from "./pdf/pageLayoutHelpers";
import { drawBatchInfo } from "./pdf/batchInfoHelpers";
import { drawJobRow } from "./pdf/jobRowHelpers";

// Main function to generate the batch overview PDF
export async function generateBatchOverview(jobs: Job[], batchName: string): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed fonts for later use
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Create first page and draw header content
  let page = addNewPage(pdfDoc);
  
  // Page margins
  const margin = 50;
  
  // Draw batch information
  drawBatchInfo(page, batchName, jobs, helveticaFont, helveticaBold, margin);
  
  // Draw table header
  const tableY = page.getHeight() - margin - 140;
  const colWidths = [220, 100, 80, 80];
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  drawTableHeader(page, tableY, colStarts, helveticaBold, margin, colWidths);
  
  // Draw job entries
  let rowY = tableY - 30;
  const rowHeight = 20;
  
  // Draw job entries
  for (let i = 0; i < jobs.length; i++) {
    // If we're about to go off the page, add a new page
    if (rowY < margin + 30) {
      page = addContinuationPage(
        pdfDoc, 
        batchName, 
        margin, 
        helveticaBold, 
        colStarts,
        helveticaFont,
        colWidths
      );
      rowY = page.getHeight() - margin - 80; // Start a bit lower on continuation pages
    }
    
    // Draw job row
    page = drawJobRow(
      page, 
      jobs[i], 
      rowY, 
      colStarts, 
      helveticaFont, 
      margin, 
      colWidths,
      rowHeight, 
      i
    );
    
    rowY -= rowHeight;
  }
  
  // Add footer
  drawFooter(page, margin, batchName, helveticaFont);
  
  // Serialize the PDFDocument to bytes
  return await pdfDoc.save();
}
