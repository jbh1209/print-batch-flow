import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

// Generic function that accepts either Job or FlyerJob
export async function generateBatchOverview(jobs: Job[] | FlyerJob[], batchName: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  
  // Create first page - single page overview
  const page = addNewPage(pdfDoc);
  const pageHeight = page.getHeight();
  const margin = 50;
  
  // Calculate optimal distribution if jobs are of type Job (business cards)
  let optimization;
  if (isBusinessCardJobs(jobs)) {
    optimization = calculateOptimalDistribution(jobs);
  } else {
    // Simple optimization for flyer jobs
    optimization = { 
      sheetsRequired: Math.ceil(jobs.reduce((sum, job) => sum + job.quantity, 0) / 4),
      distribution: null
    };
  }
  
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
  const colWidths = isBusinessCardJobs(jobs) 
    ? [150, 80, 70, 80, 100]  // Business card column widths
    : [150, 60, 60, 70, 80];  // Flyer column widths
  
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  // Draw table header
  drawCompactJobsTable(
    page, 
    jobs, 
    tableY, 
    colStarts, 
    helveticaFont, 
    helveticaBold, 
    helveticaItalic,
    margin, 
    colWidths,
    isBusinessCardJobs(jobs) ? optimization.distribution : null
  );
  
  // Calculate grid layout for preview area - fit all jobs on single page
  const gridConfig = calculateGridLayout(jobs.length, pageHeight);
  
  // Add job previews in grid layout
  await addJobPreviews(
    page,
    jobs,
    gridConfig,
    margin,
    pdfDoc,
    helveticaFont
  );
  
  // Add footer
  drawFooter(page, margin, batchName, helveticaFont);
  
  return await pdfDoc.save();
}

// Helper function to check if jobs are of type Job (business cards)
function isBusinessCardJobs(jobs: Job[] | FlyerJob[]): jobs is Job[] {
  return jobs.length > 0 && 'double_sided' in jobs[0];
}

// Function to draw compact jobs table
function drawCompactJobsTable(
  page: any, 
  jobs: Job[] | FlyerJob[], 
  tableY: number,
  colStarts: number[],
  helveticaFont: any,
  helveticaBold: any,
  helveticaItalic: any,
  margin: number,
  colWidths: number[],
  distribution: any = null
) {
  // Common header labels
  const headers = ["Job Name", "Due Date", "Quantity", isBusinessCardJobs(jobs) ? "Double-sided" : "Size", "Allocation"];
  
  // Draw table headers
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], {
      x: colStarts[i],
      y: tableY,
      size: 10,
      font: helveticaBold
    });
  }
  
  // Draw separator line
  page.drawLine({
    start: { x: margin, y: tableY - 10 },
    end: { x: margin + colWidths.reduce((a, b) => a + b, 0), y: tableY - 10 },
    thickness: 1,
    color: rgb(0, 0, 0)
  });
  
  let rowY = tableY - 25;
  const rowHeight = 15; // Compact row height
  
  // Draw job rows
  for (let i = 0; i < jobs.length && i < 10; i++) { // Limit to 10 jobs for readability
    const job = jobs[i];
    const jobY = rowY - (i * rowHeight);
    
    // Draw job name (column 1)
    page.drawText(job.name.substring(0, 18) + (job.name.length > 18 ? '...' : ''), {
      x: colStarts[0],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    // Draw due date (column 2) - formatted differently based on job type
    // Use type check instead of instanceof (which doesn't work with union types here)
    const dueDate = typeof job.due_date === 'object' && job.due_date instanceof Date ? 
      job.due_date.toLocaleDateString() : 
      (typeof job.due_date === 'string' ? new Date(job.due_date).toLocaleDateString() : 'Unknown');
    
    page.drawText(dueDate, {
      x: colStarts[1],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    // Draw quantity (column 3)
    page.drawText(job.quantity.toString(), {
      x: colStarts[2],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    // Column 4: Double-sided or Size depending on job type
    if (isBusinessCardJobs(jobs)) {
      // For business cards: Draw double-sided info
      page.drawText((job as Job).double_sided ? 'Yes' : 'No', {
        x: colStarts[3],
        y: jobY,
        size: 8,
        font: helveticaFont
      });
    } else {
      // For flyers: Draw size info
      page.drawText((job as FlyerJob).size || 'N/A', {
        x: colStarts[3],
        y: jobY,
        size: 8,
        font: helveticaFont
      });
    }
    
    // Column 5: Allocation info
    if (distribution) {
      // Business card distribution
      const jobDist = distribution.find((d: any) => d.job.id === job.id);
      if (jobDist) {
        page.drawText(`${jobDist.slotsNeeded} x ${jobDist.quantityPerSlot}`, {
          x: colStarts[4],
          y: jobY,
          size: 8,
          font: helveticaFont
        });
      }
    } else {
      // Flyer allocation - simplified for now
      page.drawText(`1 x ${job.quantity}`, {
        x: colStarts[4],
        y: jobY,
        size: 8,
        font: helveticaFont
      });
    }
  }
  
  // If there are more jobs than we can show, indicate that
  if (jobs.length > 10) {
    page.drawText(`... and ${jobs.length - 10} more jobs`, {
      x: colStarts[0],
      y: rowY - (10 * rowHeight),
      size: 8,
      font: helveticaItalic
    });
  }
}

// Function to add job previews in a grid layout
async function addJobPreviews(
  page: any,
  jobs: Job[] | FlyerJob[],
  gridConfig: any,
  margin: number,
  pdfDoc: any,
  helveticaFont: any
) {
  let currentRow = 0;
  let currentCol = 0;
  
  for (let i = 0; i < jobs.length && i < gridConfig.columns * gridConfig.rows; i++) {
    const job = jobs[i];
    const pdfUrl = isBusinessCardJobs(jobs) 
      ? (job as Job).pdf_url 
      : (job as FlyerJob).pdf_url;
    
    if (!pdfUrl) continue;
    
    try {
      // Load and embed the job's PDF
      const pdfData = await loadPdfAsBytes(pdfUrl, job.id);
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
      page.drawText(job.name.substring(0, 25) + (job.name.length > 25 ? '...' : ''), {
        x: x + (gridConfig.cellWidth / 2) - (job.name.length * 2.5),
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
}
