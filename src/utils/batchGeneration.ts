
import { Job, LaminationType } from "@/components/batches/types/BatchTypes";
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

// Function to convert and normalize different job types to Job[] with all required properties
function normalizeJobsToRequiredFormat<T extends BaseJob>(jobs: T[]): Job[] {
  return jobs.map(job => ({
    id: job.id,
    name: job.name || '',
    quantity: job.quantity,
    status: job.status,
    pdf_url: job.pdf_url,
    job_number: job.job_number || `JOB-${job.id.substring(0, 6)}`,
    file_name: job.file_name || `job-${job.id.substring(0, 6)}.pdf`,
    uploaded_at: job.uploaded_at || job.created_at || new Date().toISOString(),
    lamination_type: (job.lamination_type as LaminationType) || "none",
    size: typeof job.size === 'string' ? job.size : job.size ? String(job.size) : undefined,
    double_sided: 'double_sided' in job ? job.double_sided : undefined,
    paper_type: job.paper_type,
    sides: 'sides' in job ? job.sides : undefined,
    stock_type: 'stock_type' in job ? job.stock_type : undefined,
    single_sided: 'single_sided' in job ? job.single_sided : undefined
  }));
}

// Updated function that accepts various job types and normalizes them
export async function generateBatchOverview(jobs: Job[] | FlyerJob[] | BaseJob[], batchName: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  
  // Create first page - single page overview
  const page = addNewPage(pdfDoc);
  const pageHeight = page.getHeight();
  const margin = 50;
  
  // Normalize jobs to the required Job type format
  const normalizedJobs = normalizeJobsToRequiredFormat(jobs);
  
  // Calculate optimal distribution if jobs are of type Job (business cards)
  let optimization;
  if (isBusinessCardJobs(normalizedJobs)) {
    optimization = calculateOptimalDistribution(normalizedJobs);
  } else {
    optimization = { 
      sheetsRequired: Math.ceil(normalizedJobs.reduce((sum, job) => sum + job.quantity, 0) / 4),
      distribution: null
    };
  }
  
  // Draw batch info in top section
  drawBatchInfo(
    page, 
    batchName, 
    normalizedJobs, 
    helveticaFont, 
    helveticaBold, 
    margin, 
    optimization.sheetsRequired
  );
  
  // Draw compact jobs table - adjust position based on job type
  const tableY = isSleeveJobs(normalizedJobs) 
    ? pageHeight - margin - 130 // Position lower for sleeve jobs
    : pageHeight - margin - 110; // Default position
    
  const colWidths = isBusinessCardJobs(normalizedJobs) 
    ? [150, 80, 70, 80, 100]
    : [150, 60, 60, 100]; // Wider column for stock type
  
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  // Draw table header and jobs in a more compact form
  const finalTableY = drawCompactJobsTable(
    page, 
    normalizedJobs, 
    tableY, 
    colStarts, 
    helveticaFont, 
    helveticaBold, 
    helveticaItalic,
    margin, 
    colWidths,
    isBusinessCardJobs(normalizedJobs) ? optimization.distribution : null
  );
  
  // Calculate grid layout for preview area - starting further down
  const gridConfig = calculateGridLayout(normalizedJobs.length, pageHeight);
  
  // Add job previews in grid layout - starting below the jobs table
  await addJobPreviews(
    page,
    normalizedJobs,
    gridConfig,
    margin,
    pdfDoc,
    helveticaFont
  );
  
  // Add footer
  drawFooter(page, margin, batchName, helveticaFont);
  
  return await pdfDoc.save();
}
