
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
  
  // Draw batch info - compact positioning
  drawBatchInfo(
    page, 
    batchName, 
    jobs, 
    helveticaFont, 
    helveticaBold, 
    margin, 
    optimization.sheetsRequired
  );
  
  // Table positioning - moved higher to make room for PDF previews
  const tableStartY = pageHeight - margin - 150;
  
  // Adjusted column widths for better fit
  const colWidths = isBusinessCardJobs(jobs) 
    ? [100, 60, 50, 70, 80]
    : [100, 50, 50, 70];
  
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  // Draw table
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
  
  // Calculate preview area positioning with better spacing for PDF content
  const minPreviewStartY = finalTableY - 80; // Increased buffer for PDF previews
  const maxPreviewStartY = pageHeight - 450; // More space reserved for PDF previews
  const previewStartY = Math.min(minPreviewStartY, maxPreviewStartY);
  
  // Available height for previews
  const footerHeight = 50;
  const availablePreviewHeight = previewStartY - margin - footerHeight;
  
  // Calculate grid layout with proper constraints for PDF content
  const baseGridConfig = calculateGridLayout(jobs.length, pageHeight);
  
  // Enhanced grid configuration for PDF previews
  const gridConfig = {
    cols: Math.min(baseGridConfig.columns, 3),
    rows: Math.min(baseGridConfig.rows, 2),
    cellWidth: Math.min(baseGridConfig.cellWidth, 160), // Increased for PDF content
    cellHeight: Math.min(baseGridConfig.cellHeight, availablePreviewHeight / 2 - 30), // Better height for PDF
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
  
  // Add PDF previews with enhanced rendering
  if (availablePreviewHeight > 120) { // Increased minimum space requirement
    await addJobPreviews(
      page,
      jobs,
      gridConfig,
      margin,
      pdfDoc,
      helveticaFont
    );
  } else {
    console.log("Insufficient space for PDF previews");
  }
  
  // Add footer at bottom
  drawFooter(page, margin, batchName, helveticaFont);
  
  console.log("=== BATCH OVERVIEW GENERATION COMPLETE ===");
  
  return await pdfDoc.save();
}
