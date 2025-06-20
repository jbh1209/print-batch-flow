
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { loadPdfAsBytes } from "./pdfLoaderCore";
import { isBusinessCardJobs, isSleeveJobs } from "./jobTypeUtils";

// Helper function to safely access job number regardless of job type
const getJobNumber = (job: Job | FlyerJob | BaseJob): string => {
  if ('job_number' in job && typeof job.job_number === 'string') {
    return job.job_number;
  } else {
    // Fallback to name if job_number is not available
    return (job.name && typeof job.name === 'string') ? job.name : 'Unknown Job';
  }
};

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
  
  // Adjust preview layout for sleeve jobs
  const isSleeveJobType = isSleeveJobs(jobs);
  const previewScale = isSleeveJobType ? 0.8 : 0.9; // Smaller previews for sleeve jobs
  
  // Determine maximum number of previews based on job type
  const maxPreviews = isSleeveJobType ? 12 : 24;
  
  for (let i = 0; i < jobs.length && i < maxPreviews; i++) {
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
        (gridConfig.cellWidth * previewScale) / embeddedPage.width,
        (gridConfig.cellHeight * previewScale) / embeddedPage.height
      ) * 0.9; // Further reduce to 90% of available space
      
      // Center the preview in the cell
      const scaledWidth = embeddedPage.width * scale;
      const scaledHeight = embeddedPage.height * scale;
      const xOffset = (gridConfig.cellWidth - scaledWidth) / 2;
      const yOffset = (gridConfig.cellHeight - scaledHeight - 20) / 2;
      
      // Draw embedded page - Remove border by not drawing the rectangle
      page.drawPage(embeddedPage, {
        x: x + xOffset,
        y: y - gridConfig.cellHeight + yOffset + 20,
        width: scaledWidth,
        height: scaledHeight
      });
      
      // Add job info below preview - using job_number instead of name
      const textSize = isSleeveJobType ? 6 : 7;
      const jobNumber = getJobNumber(job);
      const displayText = jobNumber.length > 20 ? jobNumber.substring(0, 20) + '...' : jobNumber;
      page.drawText(displayText, {
        x: x + (gridConfig.cellWidth / 2) - (displayText.length * 1.8),
        y: y - gridConfig.cellHeight - 15,
        size: textSize,
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
