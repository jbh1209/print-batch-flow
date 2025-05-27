
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

export async function generateBatchOverview(
  jobs: Job[] | FlyerJob[] | BaseJob[], 
  batchName: string, 
  sheetsRequired?: number
): Promise<Uint8Array> {
  console.log("=== BATCH OVERVIEW GENERATION START ===");
  console.log("Batch name:", batchName);
  console.log("Jobs count:", jobs.length);
  console.log("Sheets required parameter received:", sheetsRequired);
  console.log("Type of sheetsRequired:", typeof sheetsRequired);
  console.log("sheetsRequired value analysis:");
  console.log("  - Is undefined:", sheetsRequired === undefined);
  console.log("  - Is null:", sheetsRequired === null);
  console.log("  - Is 0:", sheetsRequired === 0);
  console.log("  - Is truthy:", !!sheetsRequired);

  // Add cache-busting timestamp
  const generationTimestamp = Date.now();
  console.log("PDF Generation timestamp (cache-busting):", generationTimestamp);

  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  
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
  
  // CRITICAL: Use the provided sheetsRequired if available, otherwise use the calculated value
  const finalSheetsRequired = (sheetsRequired !== undefined && sheetsRequired > 0) ? sheetsRequired : optimization.sheetsRequired;
  
  console.log("=== FINAL SHEETS REQUIRED DECISION ===");
  console.log("Provided sheetsRequired:", sheetsRequired);
  console.log("Calculated optimization.sheetsRequired:", optimization.sheetsRequired);
  console.log("FINAL sheets required for PDF generation:", finalSheetsRequired);
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
  
  // CRITICAL FIX: Move table significantly further down to avoid overlap with "Sheets Required" block
  // The "Sheets Required" block is positioned at: pageHeight - margin - 125 with height of 35
  // So it occupies from y=pageHeight-margin-125 to y=pageHeight-margin-90
  // We need to start the table well below this: pageHeight - margin - 125 - 35 - 20 = pageHeight - margin - 180
  const tableY = isSleeveJobs(jobs) 
    ? pageHeight - margin - 190  // Even more space for sleeve jobs
    : pageHeight - margin - 180; // Moved down significantly more to avoid overlap
    
  console.log("=== CRITICAL TABLE POSITIONING FIX ===");
  console.log("Page height:", pageHeight);
  console.log("Margin:", margin);
  console.log("Sheets Required block ends at:", pageHeight - margin - 90);
  console.log("NEW tableY position:", tableY);
  console.log("Gap between blocks:", (pageHeight - margin - 90) - tableY);
  
  const colWidths = isBusinessCardJobs(jobs) 
    ? [150, 80, 70, 80, 100]
    : [150, 60, 60, 100];
  
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
  
  // Calculate grid layout for preview area - start previews even lower to account for lower table position
  const gridConfig = calculateGridLayout(jobs.length, pageHeight);
  // Adjust grid start position to account for much lower table position
  gridConfig.startY = Math.min(gridConfig.startY, finalTableY - 30);
  
  console.log("=== UPDATED GRID POSITIONING ===");
  console.log("Original grid startY:", calculateGridLayout(jobs.length, pageHeight).startY);
  console.log("Adjusted grid startY:", gridConfig.startY);
  console.log("Final table Y position:", finalTableY);
  
  // Add job previews in grid layout
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
  console.log("Generated PDF with sheets required:", finalSheetsRequired);
  
  return await pdfDoc.save();
}
