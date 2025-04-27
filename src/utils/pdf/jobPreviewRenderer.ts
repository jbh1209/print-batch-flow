
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
  
  for (let i = 0; i < jobs.length && i < 24; i++) {
    const job = jobs[i];
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
      
      // Calculate position in grid - account for lower startY to avoid overlap with table
      const x = margin + currentCol * (gridConfig.cellWidth + gridConfig.padding);
      const y = gridConfig.startY - currentRow * (gridConfig.cellHeight + gridConfig.padding);
      
      // Scale to fit cell while maintaining aspect ratio
      const scale = Math.min(
        (gridConfig.cellWidth - gridConfig.padding) / embeddedPage.width,
        (gridConfig.cellHeight - gridConfig.padding - 20) / embeddedPage.height
      );
      
      // Center the preview in the cell
      const scaledWidth = embeddedPage.width * scale;
      const scaledHeight = embeddedPage.height * scale;
      const xOffset = (gridConfig.cellWidth - scaledWidth) / 2;
      const yOffset = (gridConfig.cellHeight - scaledHeight - 20) / 2;
      
      // Draw embedded page
      page.drawPage(embeddedPage, {
        x: x + xOffset,
        y: y - gridConfig.cellHeight + yOffset + 20,
        width: scaledWidth,
        height: scaledHeight
      });
      
      // Add job info below preview
      const jobName = job.name.substring(0, 20) + (job.name.length > 20 ? '...' : '');
      page.drawText(jobName, {
        x: x + (gridConfig.cellWidth / 2) - (jobName.length * 2),
        y: y - gridConfig.cellHeight - 15,
        size: 7,
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
