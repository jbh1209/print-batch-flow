
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { loadPdfAsBytes } from "./pdfLoaderCore";
import { isBusinessCardJobs, isSleeveJobs } from "./jobTypeUtils";

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
      
      // Draw embedded page
      page.drawPage(embeddedPage, {
        x: x + xOffset,
        y: y - gridConfig.cellHeight + yOffset + 20,
        width: scaledWidth,
        height: scaledHeight
      });
      
      // Add job number below preview - smaller text for sleeve jobs
      const textSize = isSleeveJobType ? 6 : 7;
      
      // Determine what text to display under the preview (STRICT PRIORITY ORDER)
      let displayText = '';
      
      // 1. Job Number - HIGHEST PRIORITY
      if ('job_number' in job && typeof job.job_number === 'string' && job.job_number.trim() !== '') {
        displayText = job.job_number;
      }
      // 2. Job ID if it looks like a job number
      else if (job.id && /^[A-Z0-9]+-[A-Z0-9]+/i.test(job.id)) {
        displayText = job.id;
      }
      // 3. Name ONLY if it looks like a job number (not client name)
      else if ('name' in job && typeof job.name === 'string') {
        if (/^[A-Z0-9]+-[A-Z0-9]+/i.test(job.name) || /^[A-Z0-9]{5,}/i.test(job.name)) {
          displayText = job.name;
        } else {
          // If name doesn't look like a job number format, use ID instead
          displayText = `Job #${job.id.substring(0, 8)}`;
        }
      }
      // 4. Last resort - use part of the ID
      else if (job.id) {
        displayText = `Job #${job.id.substring(0, 8)}`;
      }
      
      // Fallback: If somehow we still don't have text, use a placeholder
      if (!displayText) {
        displayText = `Job #${i+1}`;
      }
      
      // Truncate if too long
      if (displayText.length > 15) {
        displayText = displayText.substring(0, 12) + '...';
      }
      
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
