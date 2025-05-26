
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
  
  // Draw batch info in top section - more compact layout
  drawBatchInfo(
    page, 
    batchName, 
    jobs, 
    helveticaFont, 
    helveticaBold, 
    margin, 
    optimization.sheetsRequired
  );
  
  // Better spacing calculations - batch info is more compact now
  // Batch info takes ~120px, start table at 180px from top
  const tableStartY = pageHeight - margin - 180;
  
  const colWidths = isBusinessCardJobs(jobs) 
    ? [120, 70, 60, 70, 90] // Reduced column widths
    : [120, 50, 50, 80]; // Reduced column widths for non-business cards
  
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
  
  // Calculate grid layout for preview area with better spacing
  // Add 40px buffer between table end and preview start
  const previewStartY = Math.min(finalTableY - 40, pageHeight - 350);
  const availablePreviewHeight = previewStartY - margin - 80; // More space for footer
  
  // Calculate grid config with proper spacing and reduced preview size
  const baseGridConfig = calculateGridLayout(jobs.length, pageHeight);
  const gridConfig = {
    cols: baseGridConfig.columns,
    rows: Math.min(baseGridConfig.rows, 2), // Limit to 2 rows max
    cellWidth: Math.min(baseGridConfig.cellWidth, 80), // Smaller preview cells
    cellHeight: Math.min(baseGridConfig.cellHeight, availablePreviewHeight / 2), // Ensure fit
    startY: previewStartY,
    maxHeight: availablePreviewHeight
  };
  
  console.log("Improved grid layout positioning:", {
    tableStartY,
    finalTableY, 
    previewStartY,
    availablePreviewHeight,
    gridConfig
  });
  
  // Add job previews in grid layout - smaller and better positioned
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
