
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { loadPdfAsBytes } from "./pdfLoaderCore";
import { isBusinessCardJobs } from "./jobTypeUtils";

export async function addJobPreviews(
  page: any,
  jobs: Job[] | FlyerJob[] | BaseJob[],
  gridConfig: any,
  margin: number,
  pdfDoc: any,
  helveticaFont: any
) {
  let currentRow = 0;
  let currentCol = 0;
  
  for (let i = 0; i < jobs.length && i < gridConfig.columns * gridConfig.rows; i++) {
    const job = jobs[i];
    // All job types have pdf_url
    const pdfUrl = job.pdf_url;
    
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
