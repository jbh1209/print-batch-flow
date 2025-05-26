
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { 
  addNewPage,
  calculateColumnStarts,
  drawFooter 
} from "./pdf/pageLayoutHelpers";
import { drawTableHeader } from "./pdf/tableHeaderRenderer";
import { drawBatchInfo } from "./pdf/batchInfoHelpers";
import { calculateOptimalDistribution } from "./batchOptimizationHelpers";
import { calculateGridLayout } from "./pdf/gridLayoutHelper";
import { isBusinessCardJobs, isSleeveJobs } from "./pdf/jobTypeUtils";
import { drawCompactJobsTable } from "./pdf/jobTableRenderer";
import { addJobPreviews } from "./pdf/jobPreviewRenderer";

// Updated function that accepts BaseJob[] as a valid parameter type and optional sheetsRequired
export async function generateBatchOverview(
  jobs: Job[] | FlyerJob[] | BaseJob[], 
  batchName: string, 
  sheetsRequired?: number
): Promise<Uint8Array> {
  console.log("=== BATCH OVERVIEW GENERATION START ===");
  console.log("Batch name:", batchName);
  console.log("Jobs count:", jobs.length);
  console.log("Sheets required parameter:", sheetsRequired);

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
    optimization = calculateOptimalDistribution(jobs);
    console.log("Business card optimization calculated sheets:", optimization.sheetsRequired);
  } else {
    optimization = { 
      sheetsRequired: Math.ceil(jobs.reduce((sum, job) => sum + job.quantity, 0) / 4),
      distribution: null
    };
    console.log("Non-business card calculated sheets:", optimization.sheetsRequired);
  }
  
  // Use the provided sheetsRequired if available, otherwise use the calculated value
  const finalSheetsRequired = sheetsRequired && sheetsRequired > 0 ? sheetsRequired : optimization.sheetsRequired;
  
  console.log("Final sheets required for PDF generation:", finalSheetsRequired);
  console.log("=== CALLING drawBatchInfo WITH SHEETS:", finalSheetsRequired, "===");
  
  // Draw batch info in top section with the correct sheets required value
  drawBatchInfo(
    page, 
    batchName, 
    jobs, 
    helveticaFont, 
    helveticaBold, 
    margin, 
    finalSheetsRequired
  );
  
  // Draw compact jobs table - adjust position based on job type
  const tableY = isSleeveJobs(jobs) 
    ? pageHeight - margin - 130 // Position lower for sleeve jobs
    : pageHeight - margin - 110; // Default position
    
  const colWidths = isBusinessCardJobs(jobs) 
    ? [150, 80, 70, 80, 100]
    : [150, 60, 60, 100]; // Wider column for stock type
  
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  // Draw table header and jobs in a more compact form
  const finalTableY = drawCompactJobsTable(
    page, 
    jobs, 
    tableY, 
    colStarts, 
    helveticaFont, 
    helveticaBold, 
    helveticaItalic,
    margin, 
    colWidths,
    isBusinessCardJobs(jobs) ? optimization.distribution : null
  );
  
  // Calculate grid layout for preview area - starting further down
  const gridConfig = calculateGridLayout(jobs.length, pageHeight);
  
  // Add job previews in grid layout - starting below the jobs table
  await addJobPreviews(
    page,
    jobs,
    gridConfig,
    margin,
    pdfDoc,
    helveticaFont
  );
  
  // Add footer
  drawFooter(page, margin, batchName, helveticaFont);
  
  console.log("=== BATCH OVERVIEW GENERATION COMPLETE ===");
  
  return await pdfDoc.save();
}
