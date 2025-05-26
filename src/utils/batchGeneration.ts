
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
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
import { isBusinessCardJobs, isSleeveJobs } from "./pdf/jobTypeUtils";
import { drawCompactJobsTable } from "./pdf/jobTableRenderer";
import { addJobPreviews } from "./pdf/jobPreviewRenderer";

export async function generateBatchOverview(jobs: Job[] | FlyerJob[] | BaseJob[], batchName: string): Promise<Uint8Array> {
  console.log("=== GENERATING BATCH OVERVIEW ===");
  console.log("Batch name:", batchName);
  console.log("Jobs count:", jobs.length);
  
  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  
  const page = addNewPage(pdfDoc);
  const pageHeight = page.getHeight();
  const pageWidth = page.getWidth();
  const margin = 50;
  
  // Calculate optimal distribution if jobs are of type Job (business cards)
  let optimization;
  if (isBusinessCardJobs(jobs)) {
    console.log("Jobs identified as business cards");
    optimization = calculateOptimalDistribution(jobs);
    console.log("Optimization calculated - sheets required:", optimization.sheetsRequired);
  } else {
    console.log("Jobs NOT identified as business cards");
    optimization = { 
      sheetsRequired: Math.ceil(jobs.reduce((sum, job) => sum + job.quantity, 0) / 4),
      distribution: null
    };
  }
  
  // Draw batch info - more compact and positioned higher
  drawBatchInfo(
    page, 
    batchName, 
    jobs, 
    helveticaFont, 
    helveticaBold, 
    margin, 
    optimization.sheetsRequired
  );
  
  // Improved spacing - batch info is now more compact, start table higher
  const tableStartY = pageHeight - margin - 140; // Moved up from 180 to 140
  
  // Reduced column widths for better fit
  const colWidths = isBusinessCardJobs(jobs) 
    ? [100, 60, 50, 70, 80] // Further reduced widths
    : [100, 50, 50, 70]; // Further reduced widths for non-business cards
  
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  // Draw table with improved positioning
  const finalTableY = drawCompactJobsTable(
    page, 
    jobs, 
    tableStartY, 
    colStarts, 
    helveticaFont, 
    helveticaBold, 
    helveticaItalic,
    margin, 
    colWidths,
    isBusinessCardJobs(jobs) ? optimization.distribution : null
  );
  
  // Calculate preview area positioning with better spacing control
  const minPreviewStartY = finalTableY - 60; // Increased buffer from 40 to 60
  const maxPreviewStartY = pageHeight - 400; // Reserve more space for previews
  const previewStartY = Math.min(minPreviewStartY, maxPreviewStartY);
  
  // Available height for previews
  const footerHeight = 50;
  const availablePreviewHeight = previewStartY - margin - footerHeight;
  
  // Calculate grid layout with proper constraints
  const baseGridConfig = calculateGridLayout(jobs.length, pageHeight);
  
  // Improved grid configuration with better sizing
  const gridConfig = {
    cols: Math.min(baseGridConfig.columns, 3), // Limit to 3 columns max
    rows: Math.min(baseGridConfig.rows, 2), // Limit to 2 rows max
    cellWidth: Math.min(baseGridConfig.cellWidth, 120), // Increased from 80 to 120
    cellHeight: Math.min(baseGridConfig.cellHeight, availablePreviewHeight / 2 - 20), // Better height calculation
    startY: previewStartY,
    maxHeight: availablePreviewHeight
  };
  
  console.log("Final layout positioning:", {
    pageHeight,
    pageWidth,
    tableStartY,
    finalTableY, 
    previewStartY,
    availablePreviewHeight,
    gridConfig
  });
  
  // Only add previews if there's sufficient space
  if (availablePreviewHeight > 100) {
    await addJobPreviews(
      page,
      jobs,
      gridConfig,
      margin,
      pdfDoc,
      helveticaFont
    );
  } else {
    console.log("Insufficient space for job previews");
  }
  
  // Add footer at bottom
  drawFooter(page, margin, batchName, helveticaFont);
  
  console.log("=== BATCH OVERVIEW GENERATION COMPLETE ===");
  
  return await pdfDoc.save();
}
