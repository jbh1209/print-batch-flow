
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
  
  const previewStartY = gridConfig.startY || 300;
  const maxHeight = gridConfig.maxHeight || 200;
  
  // Ensure we don't exceed available space and maintain proper aspect ratio
  const cellHeight = Math.min(gridConfig.cellHeight, maxHeight / gridConfig.rows);
  const cellWidth = Math.min(gridConfig.cellWidth, 140); // Increased max width
  
  console.log("Preview positioning:", {
    previewStartY,
    maxHeight,
    cellHeight,
    cellWidth,
    rows: gridConfig.rows,
    cols: gridConfig.cols
  });
  
  // Limit jobs to display based on available grid space
  const maxJobsToDisplay = gridConfig.cols * gridConfig.rows;
  const jobsToDisplay = jobs.slice(0, maxJobsToDisplay);
  
  // Calculate proper spacing to center the grid
  const totalGridWidth = gridConfig.cols * cellWidth + (gridConfig.cols - 1) * 25; // 25px spacing
  const availableWidth = page.getWidth() - 2 * margin;
  const gridStartX = margin + (availableWidth - totalGridWidth) / 2;
  
  jobsToDisplay.forEach((job, index) => {
    const row = Math.floor(index / gridConfig.cols);
    const col = index % gridConfig.cols;
    
    // Improved positioning with proper centering and spacing
    const x = gridStartX + (col * (cellWidth + 25)); // 25px spacing between cells
    const y = previewStartY - (row * (cellHeight + 35)); // 35px spacing between rows
    
    // Ensure we don't draw below the footer area
    const minY = margin + 60; // Footer area
    if (y - cellHeight < minY) {
      console.log(`Skipping job ${index} - would overlap footer at y=${y}, minY=${minY}`);
      return;
    }
    
    // Draw job preview with consistent styling
    drawJobPreviewPlaceholder(page, job, x, y, cellWidth, cellHeight, helveticaFont);
  });
  
  // Add note for remaining jobs if any
  if (jobs.length > jobsToDisplay.length) {
    const remainingCount = jobs.length - jobsToDisplay.length;
    const noteY = previewStartY - (gridConfig.rows * (cellHeight + 35)) - 15;
    
    // Only show note if there's space
    if (noteY > margin + 40) {
      page.drawText(`+ ${remainingCount} more jobs not shown`, {
        x: margin,
        y: noteY,
        size: 8,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5)
      });
    }
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
  // Draw border with consistent styling
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98) // Light background
  });
  
  // Draw job identifier with proper text sizing
  const jobIdentifier = getJobIdentifier(job);
  const displayText = jobIdentifier.length > 15 ? jobIdentifier.substring(0, 12) + '...' : jobIdentifier;
  
  // Center the text in the preview box
  page.drawText(displayText, {
    x: x + 8,
    y: y - height + 8,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.3)
  });
  
  // Add a small indicator for the job type
  page.drawText("Preview", {
    x: x + 8,
    y: y - height + height - 18,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.6)
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
