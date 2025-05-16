
import { Job } from "@/components/batches/types/BatchTypes";
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

// Updated function that accepts various job types
export async function generateBatchOverview(jobs: Job[] | FlyerJob[] | BaseJob[], batchName: string): Promise<Uint8Array> {
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
    const typedJobs = jobs as Job[];
    optimization = calculateOptimalDistribution(typedJobs);
  } else {
    optimization = { 
      sheetsRequired: Math.ceil(jobs.reduce((sum, job) => sum + job.quantity, 0) / 4),
      distribution: null
    };
  }
  
  // Draw batch info in top section
  drawBatchInfo(
    page, 
    batchName, 
    jobs, 
    helveticaFont, 
    helveticaBold, 
    margin, 
    optimization.sheetsRequired
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
  
  return await pdfDoc.save();
}
