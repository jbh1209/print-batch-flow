
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
import { calculateOptimalDistribution } from "./batchOptimizationHelpers";
import { calculateGridLayout } from "./pdf/gridLayoutHelper";
import { loadPdfAsBytes } from "./pdf/pdfLoaderCore";

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
  
  // Draw table header and jobs list (abbreviated version)
  const tableY = page.getHeight() - margin - 160;
  const colWidths = [150, 80, 70, 80, 100];
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  drawTableHeader(page, tableY, colStarts, helveticaBold, margin, colWidths, true);
  
  let rowY = tableY - 30;
  const rowHeight = 20;
  
  // Draw job entries with distribution info
  const distributionMap = new Map(
    optimization.distribution.map(item => [item.job.id, { 
      slots: item.slotsNeeded, 
      quantityPerSlot: item.quantityPerSlot 
    }])
  );
  
  for (let i = 0; i < jobs.length; i++) {
    const slotInfo = distributionMap.get(jobs[i].id);
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
  
  // Calculate grid layout for job previews
  const gridConfig = calculateGridLayout(jobs.length, page.getHeight());
  
  // Add job previews in grid layout
  let currentRow = 0;
  let currentCol = 0;
  
  for (let i = 0; i < jobs.length && i < 9; i++) {
    const job = jobs[i];
    if (!job.pdf_url) continue;

    try {
      // Load the job's PDF
      const pdfData = await loadPdfAsBytes(job.pdf_url, job.id);
      if (!pdfData?.buffer) continue;

      // Load the PDF document
      const jobPdf = await PDFDocument.load(pdfData.buffer);
      if (jobPdf.getPageCount() === 0) continue;

      // Copy the first page
      const [jobPage] = await pdfDoc.copyPages(jobPdf, [0]);
      
      // Calculate position in grid
      const x = margin + currentCol * (gridConfig.cellWidth + gridConfig.padding);
      const y = gridConfig.startY - currentRow * (gridConfig.cellHeight + gridConfig.padding);
      
      // Add the page to the document and scale it to fit the cell
      const scale = Math.min(
        gridConfig.cellWidth / jobPage.getWidth(),
        gridConfig.cellHeight / jobPage.getHeight()
      );
      
      page.drawPage(jobPage, {
        x,
        y: y - gridConfig.cellHeight, // Adjust y position
        width: jobPage.getWidth() * scale,
        height: jobPage.getHeight() * scale
      });
      
      // Add job name below preview
      page.drawText(job.name, {
        x: x + (gridConfig.cellWidth / 2) - (job.name.length * 3),
        y: y - gridConfig.cellHeight - 15,
        size: 8,
        font: helveticaFont
      });
      
      // Update grid position
      currentCol++;
      if (currentCol >= gridConfig.columns) {
        currentCol = 0;
        currentRow++;
      }
    } catch (error) {
      console.error(`Error adding preview for job ${job.id}:`, error);
      continue;
    }
  }
  
  // Add footer
  drawFooter(page, margin, batchName, helveticaFont);
  
  // Serialize the PDFDocument to bytes
  return await pdfDoc.save();
}
