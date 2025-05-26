
import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";

interface GridConfig {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  startY?: number;
  maxHeight?: number;
}

export async function addJobPreviews(
  page: PDFPage,
  jobs: Job[] | FlyerJob[] | BaseJob[],
  gridConfig: GridConfig,
  margin: number,
  pdfDoc: PDFDocument,
  helveticaFont: any
): Promise<void> {
  console.log("Adding job previews with grid config:", gridConfig);
  
  // Use provided startY or calculate default
  const previewStartY = gridConfig.startY || 300;
  const maxHeight = gridConfig.maxHeight || 200;
  
  // Ensure we don't exceed the available space
  const cellHeight = Math.min(gridConfig.cellHeight, maxHeight / gridConfig.rows);
  const cellWidth = gridConfig.cellWidth;
  
  console.log("Preview positioning:", {
    previewStartY,
    maxHeight,
    cellHeight,
    cellWidth
  });
  
  // Limit the number of jobs to display based on available space
  const maxJobsToDisplay = gridConfig.cols * gridConfig.rows;
  const jobsToDisplay = jobs.slice(0, maxJobsToDisplay);
  
  jobsToDisplay.forEach((job, index) => {
    const row = Math.floor(index / gridConfig.cols);
    const col = index % gridConfig.cols;
    
    const x = margin + (col * (cellWidth + 20)); // 20px spacing between cells
    const y = previewStartY - (row * (cellHeight + 30)); // 30px spacing between rows
    
    // Skip if this would go below the footer area
    if (y - cellHeight < margin + 30) {
      console.log(`Skipping job ${index} - would overlap footer`);
      return;
    }
    
    // Draw job preview placeholder
    drawJobPreviewPlaceholder(page, job, x, y, cellWidth, cellHeight, helveticaFont);
  });
  
  // Add note if some jobs were skipped
  if (jobs.length > jobsToDisplay.length) {
    const remainingCount = jobs.length - jobsToDisplay.length;
    page.drawText(`+ ${remainingCount} more jobs not shown`, {
      x: margin,
      y: previewStartY - (gridConfig.rows * (cellHeight + 30)) - 20,
      size: 9,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5)
    });
  }
}

function drawJobPreviewPlaceholder(
  page: PDFPage,
  job: Job | FlyerJob | BaseJob,
  x: number,
  y: number,
  width: number,
  height: number,
  font: any
): void {
  // Draw border
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1
  });
  
  // Draw job identifier - get job number safely
  const jobIdentifier = getJobIdentifier(job);
  const displayText = jobIdentifier.length > 12 ? jobIdentifier.substring(0, 9) + '...' : jobIdentifier;
  
  page.drawText(displayText, {
    x: x + 5,
    y: y - height + 5,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.3)
  });
}

function getJobIdentifier(job: Job | FlyerJob | BaseJob): string {
  // Try different properties to get a job identifier
  if ('job_number' in job && job.job_number) {
    return job.job_number;
  }
  if ('name' in job && job.name) {
    return job.name;
  }
  return `Job ${job.id}`;
}
