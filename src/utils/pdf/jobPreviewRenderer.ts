
import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { loadPdfAsBytes } from "./pdfLoaderCore";

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
  const cellWidth = Math.min(gridConfig.cellWidth, 140);
  
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
  const totalGridWidth = gridConfig.cols * cellWidth + (gridConfig.cols - 1) * 25;
  const availableWidth = page.getWidth() - 2 * margin;
  const gridStartX = margin + (availableWidth - totalGridWidth) / 2;
  
  // Process jobs and render previews
  for (let index = 0; index < jobsToDisplay.length; index++) {
    const job = jobsToDisplay[index];
    const row = Math.floor(index / gridConfig.cols);
    const col = index % gridConfig.cols;
    
    const x = gridStartX + (col * (cellWidth + 25));
    const y = previewStartY - (row * (cellHeight + 35));
    
    // Ensure we don't draw below the footer area
    const minY = margin + 60;
    if (y - cellHeight < minY) {
      console.log(`Skipping job ${index} - would overlap footer at y=${y}, minY=${minY}`);
      continue;
    }
    
    // Draw job preview with actual PDF content
    await drawJobPreviewWithPdf(page, job, x, y, cellWidth, cellHeight, helveticaFont, pdfDoc);
  }
  
  // Add note for remaining jobs if any
  if (jobs.length > jobsToDisplay.length) {
    const remainingCount = jobs.length - jobsToDisplay.length;
    const noteY = previewStartY - (gridConfig.rows * (cellHeight + 35)) - 15;
    
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

async function drawJobPreviewWithPdf(
  page: PDFPage,
  job: Job | FlyerJob | BaseJob,
  x: number,
  y: number,
  width: number,
  height: number,
  font: any,
  targetPdf: PDFDocument
): Promise<void> {
  console.log(`Drawing preview for job ${job.id}`);
  
  // Draw border
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(1, 1, 1)
  });
  
  try {
    // Get PDF URL - handle different job types
    let pdfUrl = '';
    if ('pdf_url' in job && job.pdf_url) {
      pdfUrl = job.pdf_url;
    } else if ('front_pdf_url' in job && job.front_pdf_url) {
      pdfUrl = job.front_pdf_url;
    }
    
    if (!pdfUrl) {
      throw new Error('No PDF URL found');
    }
    
    // Load the PDF content
    const pdfData = await loadPdfAsBytes(pdfUrl, job.id);
    if (!pdfData || !pdfData.buffer) {
      throw new Error('Failed to load PDF data');
    }
    
    // Load PDF document
    const sourcePdf = await PDFDocument.load(pdfData.buffer);
    if (sourcePdf.getPageCount() === 0) {
      throw new Error('PDF has no pages');
    }
    
    // Copy the first page from the source PDF
    const [copiedPage] = await targetPdf.copyPages(sourcePdf, [0]);
    
    // Scale and position the copied page to fit in the preview area
    const originalSize = copiedPage.getSize();
    const scaleX = (width - 10) / originalSize.width;  // 10px margin
    const scaleY = (height - 25) / originalSize.height; // 25px for text area
    const scale = Math.min(scaleX, scaleY, 0.3); // Limit scale to 0.3
    
    const scaledWidth = originalSize.width * scale;
    const scaledHeight = originalSize.height * scale;
    
    // Center the preview in the available space
    const previewX = x + (width - scaledWidth) / 2;
    const previewY = y - height + 20 + (height - 20 - scaledHeight) / 2; // 20px for text
    
    // Draw the PDF page content
    page.drawPage(copiedPage, {
      x: previewX,
      y: previewY,
      width: scaledWidth,
      height: scaledHeight
    });
    
    console.log(`Successfully rendered PDF preview for job ${job.id}`);
    
  } catch (error) {
    console.error(`Error rendering PDF preview for job ${job.id}:`, error);
    
    // Fall back to placeholder
    page.drawText("PDF Preview", {
      x: x + width / 2 - 30,
      y: y - height / 2,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });
  }
  
  // Draw job identifier at the bottom
  const jobIdentifier = getJobIdentifier(job);
  const displayText = jobIdentifier.length > 15 ? jobIdentifier.substring(0, 12) + '...' : jobIdentifier;
  
  // Black background for text
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height: 20,
    color: rgb(0, 0, 0)
  });
  
  // White text on black background
  page.drawText(displayText, {
    x: x + 5,
    y: y - height + 6,
    size: 8,
    font,
    color: rgb(1, 1, 1)
  });
}

function getJobIdentifier(job: Job | FlyerJob | BaseJob): string {
  if ('job_number' in job && job.job_number) {
    return job.job_number;
  }
  if ('name' in job && job.name) {
    return job.name;
  }
  return `Job ${job.id}`;
}
