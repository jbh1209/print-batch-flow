
import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { 
  addNewPage,
  calculateColumnStarts,
  drawTableHeader,
  drawFooter 
} from "./pdf/pageLayoutHelpers";
import { drawBatchInfo } from "./pdf/batchInfoHelpers";
import { calculateOptimalDistribution } from "./batchOptimizationHelpers";
import { calculateGridLayout } from "./pdf/gridLayoutHelper";
import { loadPdfAsBytes } from "./pdf/pdfLoaderCore";

export async function generateBatchOverview(jobs: Job[], batchName: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Create first page
  const page = addNewPage(pdfDoc);
  const pageHeight = page.getHeight();
  const margin = 50;
  
  // Calculate optimal distribution
  const optimization = calculateOptimalDistribution(jobs);
  
  // Draw batch info in top section
  drawBatchInfo(
    page, 
    batchName, 
    jobs, 
    helveticaFont, 
    helveticaBold, 
    margin, 
    optimization.sheetsRequired
  );
  
  // Draw compact jobs table in top 25% of page
  const tableY = pageHeight - margin - 160;
  const colWidths = [150, 80, 70, 80, 100];
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  drawTableHeader(page, tableY, colStarts, helveticaBold, margin, colWidths, true);
  
  let rowY = tableY - 30;
  const rowHeight = 15; // Reduced height for compact layout
  
  const distributionMap = new Map(
    optimization.distribution.map(item => [item.job.id, { 
      slots: item.slotsNeeded, 
      quantityPerSlot: item.quantityPerSlot 
    }])
  );
  
  // Draw job list with compact spacing
  for (let i = 0; i < jobs.length; i++) {
    const slotInfo = distributionMap.get(jobs[i].id);
    const jobY = rowY - (i * rowHeight);
    
    // Draw job row with reduced spacing
    page.drawText(jobs[i].name, {
      x: colStarts[0],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    page.drawText(jobs[i].quantity.toString(), {
      x: colStarts[2],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    if (slotInfo) {
      page.drawText(`${slotInfo.slots} x ${slotInfo.quantityPerSlot}`, {
        x: colStarts[4],
        y: jobY,
        size: 8,
        font: helveticaFont
      });
    }
  }
  
  // Calculate grid layout for preview area
  const gridConfig = calculateGridLayout(jobs.length, pageHeight);
  
  // Add job previews in grid layout
  let currentRow = 0;
  let currentCol = 0;
  
  for (let i = 0; i < jobs.length && i < 9; i++) {
    const job = jobs[i];
    if (!job.pdf_url) continue;
    
    try {
      // Load and embed the job's PDF
      const pdfData = await loadPdfAsBytes(job.pdf_url, job.id);
      if (!pdfData?.buffer) continue;
      
      // Load PDF document
      const jobPdf = await PDFDocument.load(pdfData.buffer);
      if (jobPdf.getPageCount() === 0) continue;
      
      // Get and embed first page
      const [firstPage] = jobPdf.getPages();
      const embeddedPage = await pdfDoc.embedPage(firstPage);
      
      // Calculate position in grid
      const x = margin + currentCol * (gridConfig.cellWidth + gridConfig.padding);
      const y = gridConfig.startY - currentRow * (gridConfig.cellHeight + gridConfig.padding);
      
      // Scale to fit cell while maintaining aspect ratio
      const scale = Math.min(
        gridConfig.cellWidth / embeddedPage.width,
        gridConfig.cellHeight / embeddedPage.height
      );
      
      // Draw embedded page
      page.drawPage(embeddedPage, {
        x,
        y: y - gridConfig.cellHeight,
        width: embeddedPage.width * scale,
        height: embeddedPage.height * scale
      });
      
      // Add job info below preview
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
  
  return await pdfDoc.save();
}
