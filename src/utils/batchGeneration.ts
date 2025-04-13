
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
import { drawJobRow, drawOptimizationInfo } from "./pdf/jobRowHelpers";
import { calculateOptimalDistribution } from "./batchOptimizationHelpers";

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
  
  // Calculate optimal distribution for these jobs
  const optimization = calculateOptimalDistribution(jobs);
  
  // Draw batch information
  drawBatchInfo(
    page, 
    batchName, 
    jobs, 
    helveticaFont, 
    helveticaBold, 
    margin, 
    optimization.sheetsRequired
  );
  
  // Draw table header
  const tableY = page.getHeight() - margin - 140;
  const colWidths = [190, 100, 80, 100, 120]; // Added width for slot allocation column
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  drawTableHeader(page, tableY, colStarts, helveticaBold, margin, colWidths, true);
  
  // Draw job entries
  let rowY = tableY - 30;
  const rowHeight = 20;
  
  // Find corresponding distribution info for each job
  const distributionMap = new Map(
    optimization.distribution.map(item => [item.job.id, { 
      slots: item.slotsNeeded, 
      quantityPerSlot: item.quantityPerSlot 
    }])
  );
  
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
    
    // Get slot info for this job
    const slotInfo = distributionMap.get(jobs[i].id);
    
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
      i,
      slotInfo
    );
    
    rowY -= rowHeight;
  }
  
  // Add optimization details section
  if (optimization) {
    // Only add a new page if there's not enough space
    if (rowY < margin + 100) {
      page = addContinuationPage(
        pdfDoc, 
        batchName, 
        margin, 
        helveticaBold, 
        colStarts,
        helveticaFont,
        colWidths
      );
      rowY = page.getHeight() - margin - 80;
    } else {
      // Add some spacing
      rowY -= 40;
    }
    
    // Draw optimization information
    rowY = drawOptimizationInfo(
      page,
      optimization.distribution,
      rowY,
      colStarts,
      helveticaFont,
      helveticaBold,
      margin,
      colWidths
    );
  }
  
  // Add footer
  drawFooter(page, margin, batchName, helveticaFont);
  
  // Serialize the PDFDocument to bytes
  return await pdfDoc.save();
}
