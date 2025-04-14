
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { loadSingleJobPdf, loadMultipleJobPdfs } from "./pdfLoaderCore";
import { createEmptyPdf } from "./emptyPdfGenerator";

// Load all job PDFs with better error handling and logging
export async function loadJobPDFs(jobs: Job[]) {
  console.log(`Starting to load ${jobs.length} job PDFs...`);
  
  // First, check if we have any PDF URLs at all
  const jobsWithPdfs = jobs.filter(job => job.pdf_url);
  if (jobsWithPdfs.length === 0) {
    console.error("None of the jobs have PDF URLs!");
    return [];
  }

  // Generate empty PDFs for jobs without PDFs as a fallback
  const emptyPdfPromises = jobs
    .filter(job => !job.pdf_url)
    .map(async job => {
      const emptyPdf = await createEmptyPdf(job);
      return { job, pdfDoc: emptyPdf, isDuplicated: false };
    });

  // Load actual PDFs where URLs exist
  const jobPDFPromises = jobs.map((job, index) => loadSingleJobPdf(job, index));
  
  // Combine the results, filter out nulls, and include fallback empty PDFs
  const allPdfLoads = [...await Promise.all(jobPDFPromises), ...await Promise.all(emptyPdfPromises)];
  
  // Filter out any failed PDF loads
  const validPDFs = allPdfLoads.filter(item => item !== null) as { 
    job: Job; 
    pdfDoc: PDFDocument; 
    isDuplicated: boolean;
  }[];
  
  console.log(`Successfully loaded ${validPDFs.length} out of ${jobs.length} PDFs`);
  return validPDFs;
}

// Type definitions for position mapping
export interface PositionMapping {
  job: Job;
  pdfDoc: PDFDocument;
  page: number;
  position: number;
  embeddedPage?: any;
}

export interface SheetLayout {
  frontPositions: PositionMapping[];
  backPositions: PositionMapping[];
}

/**
 * Creates a position mapping for imposition with proper front/back alignment
 * This is the core function that determines which job goes where on the sheet
 */
export async function createImpositionLayout(jobs: Job[], slotsPerSheet: number): Promise<SheetLayout> {
  console.log(`Creating imposition layout for ${jobs.length} jobs with ${slotsPerSheet} slots per sheet...`);
  
  const frontPositions: PositionMapping[] = [];
  const backPositions: PositionMapping[] = [];
  
  // Load all PDFs first
  const jobPDFs = await loadMultipleJobPdfs(jobs);
  console.log(`Successfully loaded PDFs for ${jobPDFs.size} out of ${jobs.length} jobs`);
  
  // Debug logging for quantities
  jobs.forEach(job => {
    console.log(`Job ${job.id} (${job.name}): Quantity ${job.quantity || 1}, Double-sided: ${job.double_sided}`);
  });
  
  let currentPosition = 0;
  
  // Process each job and its quantities
  for (const job of jobs) {
    if (!job.id || !jobPDFs.has(job.id)) {
      console.warn(`Skipping job ${job.id || 'unknown'} due to missing PDF`);
      continue;
    }
    
    const jobData = jobPDFs.get(job.id)!;
    const quantity = Math.max(1, job.quantity || 1); // Ensure at least 1 copy
    const pageCount = jobData.pdfDoc.getPageCount();
    
    console.log(`Processing job ${job.id} (${job.name}) - Quantity: ${quantity}, Pages: ${pageCount}`);
    
    // Add copies based on quantity
    for (let i = 0; i < quantity && currentPosition < slotsPerSheet; i++) {
      console.log(`Adding copy ${i + 1}/${quantity} of job ${job.id} at position ${currentPosition}`);
      
      // Add front page with PDF content
      frontPositions.push({
        job,
        pdfDoc: jobData.pdfDoc,
        page: 0, // Front is always page 0
        position: currentPosition
      });
      
      // Add back page if double-sided
      if (job.double_sided) {
        const backPosition = calculateBackPosition(currentPosition, slotsPerSheet);
        console.log(`Adding back page for job ${job.id} at position ${backPosition}`);
        
        backPositions.push({
          job,
          pdfDoc: jobData.pdfDoc,
          page: pageCount > 1 ? 1 : 0, // Use page 1 if exists, otherwise page 0
          position: backPosition
        });
      }
      
      currentPosition++;
      if (currentPosition >= slotsPerSheet) {
        console.log(`Reached maximum slots (${slotsPerSheet})`);
        break;
      }
    }
  }
  
  // Sort arrays by position for consistent rendering
  frontPositions.sort((a, b) => a.position - b.position);
  backPositions.sort((a, b) => a.position - b.position);
  
  console.log("\nFinal front positions layout:");
  frontPositions.forEach((mapping) => {
    console.log(`Position ${mapping.position}: Job ${mapping.job.id} (${mapping.job.name}) - Page ${mapping.page}`);
  });
  
  console.log("\nFinal back positions layout:");
  backPositions.forEach((mapping) => {
    console.log(`Position ${mapping.position}: Job ${mapping.job.id} (${mapping.job.name}) - Page ${mapping.page}`);
  });
  
  return { frontPositions, backPositions };
}

/**
 * Calculate the corresponding position on the back side for double-sided printing
 * This uses a mirroring approach to ensure proper alignment when printed double-sided
 */
function calculateBackPosition(frontPosition: number, slotsPerSheet: number): number {
  // For a 3x8 grid (24 slots), we need to:
  // 1. Determine the row (0-7)
  // 2. Determine the column (0-2)
  // 3. Calculate the mirrored position
  
  const columns = 3; // Standard is 3 columns
  const rows = slotsPerSheet / columns; // Should be 8 rows for 24 slots
  
  const row = Math.floor(frontPosition / columns);
  const col = frontPosition % columns;
  
  // When flipping for double-sided printing:
  // - Same row
  // - Column becomes (columns - 1 - col)
  const mirroredCol = (columns - 1) - col;
  const backPosition = (row * columns) + mirroredCol;
  
  console.log(`Front position ${frontPosition} (row ${row}, col ${col}) maps to back position ${backPosition} (row ${row}, col ${mirroredCol})`);
  
  return backPosition;
}
