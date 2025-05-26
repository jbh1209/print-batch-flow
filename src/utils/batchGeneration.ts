
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

// Updated function that accepts BaseJob[] as a valid parameter type
export async function generateBatchOverview(jobs: Job[] | FlyerJob[] | BaseJob[], batchName: string): Promise<Uint8Array> {
  console.log("=== GENERATING BATCH OVERVIEW ===");
  console.log("Batch name:", batchName);
  console.log("Jobs count:", jobs.length);
  console.log("Jobs type check - first job keys:", jobs[0] ? Object.keys(jobs[0]) : 'no jobs');
  
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
    console.log("Jobs identified as business cards");
    optimization = calculateOptimalDistribution(jobs);
    console.log("Optimization calculated - sheets required:", optimization.sheetsRequired);
  } else {
    console.log("Jobs NOT identified as business cards");
    optimization = { 
      sheetsRequired: Math.ceil(jobs.reduce((sum, job) => sum + job.quantity, 0) / 4),
      distribution: null
    };
    console.log("Default optimization - sheets required:", optimization.sheetsRequired);
  }
  
  // Draw batch info in top section (takes up about 150px)
  drawBatchInfo(
    page, 
    batchName, 
    jobs, 
    helveticaFont, 
    helveticaBold, 
    margin, 
    optimization.sheetsRequired
  );
  
  // Calculate proper spacing for table position
  // Batch info takes ~150px, so start table at 220px from top to give more space
  const tableStartY = pageHeight - margin - 220;
  
  const colWidths = isBusinessCardJobs(jobs) 
    ? [150, 80, 70, 80, 100]
    : [150, 60, 60, 100]; // Wider column for stock type
  
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  // Draw table header and jobs in a more compact form
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
  
  // Calculate grid layout for preview area - ensure enough space between table and previews
  // Add 60px buffer between table end and preview start
  const previewStartY = Math.min(finalTableY - 60, pageHeight - 450); // Ensure previews don't go too high
  const availablePreviewHeight = previewStartY - margin - 60; // Leave more space for footer
  
  // Calculate grid config with proper spacing - fix property names to match GridConfig interface
  const baseGridConfig = calculateGridLayout(jobs.length, pageHeight);
  const gridConfig = {
    cols: baseGridConfig.columns, // Map columns to cols
    rows: baseGridConfig.rows,
    cellWidth: baseGridConfig.cellWidth,
    cellHeight: Math.min(baseGridConfig.cellHeight, availablePreviewHeight / baseGridConfig.rows),
    startY: previewStartY,
    maxHeight: availablePreviewHeight
  };
  
  console.log("Grid layout positioning:", {
    tableStartY,
    finalTableY, 
    previewStartY,
    availablePreviewHeight,
    gridConfig
  });
  
  // Add job previews in grid layout - starting below the jobs table with proper spacing
  await addJobPreviews(
    page,
    jobs,
    gridConfig,
    margin,
    pdfDoc,
    helveticaFont
  );
  
  // Add footer at bottom
  drawFooter(page, margin, batchName, helveticaFont);
  
  console.log("=== BATCH OVERVIEW GENERATION COMPLETE ===");
  
  return await pdfDoc.save();
}
