
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { loadSingleJobPdf, loadMultipleJobPdfs, createIndependentPdfCopy } from "./pdfLoaderCore";
import { createEmptyPdf } from "./emptyPdfGenerator";

// Store job PDFs with better error handling and logging
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

  // Load actual PDFs where URLs exist - ensuring each job gets a completely independent PDF
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

// Type definitions for position mapping - enhanced with more explicit tracking
export interface PositionMapping {
  job: Job;
  pdfDoc: PDFDocument;  // Each position mapping has its own independent PDF copy
  page: number;
  position: number;
  embeddedPage?: any;
}

export interface SheetLayout {
  frontPositions: PositionMapping[];
  backPositions: PositionMapping[];
}

/**
 * Creates a mapping between jobs and positions with explicit tracking of quantities
 * COMPLETELY REWRITTEN to ensure position isolation and prevent repeated cards
 */
export async function createImpositionLayout(jobs: Job[], slotsPerSheet: number): Promise<SheetLayout> {
  console.log(`CREATING NEW IMPOSITION LAYOUT for ${jobs.length} jobs with ${slotsPerSheet} slots per sheet`);
  
  // First load all PDFs and create a master reference map
  const masterPdfMap = await loadMultipleJobPdfs(jobs);
  console.log(`Successfully loaded master PDFs for ${masterPdfMap.size} out of ${jobs.length} jobs`);
  
  // Create arrays for front and back positions
  const frontPositions: PositionMapping[] = [];
  const backPositions: PositionMapping[] = [];
  
  // Debug logging for quantities and double-sided flags
  jobs.forEach(job => {
    console.log(`Job ID ${job.id} (${job.name}): Quantity ${job.quantity || 1}, Double-sided: ${job.double_sided}`);
  });
  
  // IMPORTANT: Current position counter
  let currentPosition = 0;
  
  // Process each job one at a time, handling all its quantities before moving to next job
  for (const job of jobs) {
    if (!job.id || !masterPdfMap.has(job.id)) {
      console.warn(`Skipping job ${job.id || 'unknown'}: Missing PDF`);
      continue;
    }
    
    const masterJobData = masterPdfMap.get(job.id)!;
    const quantity = Math.max(1, job.quantity || 1); // Ensure at least 1 copy
    const pageCount = masterJobData.pdfDoc.getPageCount();
    
    console.log(`Processing job ${job.id} (${job.name}) - Quantity: ${quantity}, Pages: ${pageCount}`);
    
    // Add copies based on quantity - CRITICAL: create independent PDF copies for each position
    for (let i = 0; i < quantity && currentPosition < slotsPerSheet; i++) {
      const copyNumber = i + 1;
      console.log(`Adding copy ${copyNumber}/${quantity} of job ${job.id} at position ${currentPosition}`);
      
      try {
        // Create an independent copy of the PDF for this specific position to prevent reference sharing
        const independentPdfCopy = await createIndependentPdfCopy(masterJobData.pdfDoc);
        console.log(`Created independent PDF copy for job ${job.id}, copy ${copyNumber}`);
        
        // Add front page with PDF content
        frontPositions.push({
          job,
          pdfDoc: independentPdfCopy, // Use the independent copy
          page: 0, // Front is always page 0
          position: currentPosition
        });
        
        // Add back page if double-sided
        if (job.double_sided) {
          const backPosition = calculateBackPosition(currentPosition, slotsPerSheet);
          console.log(`Adding back page for job ${job.id} at position ${backPosition}`);
          
          // Create another independent copy for the back side
          const backPdfCopy = await createIndependentPdfCopy(masterJobData.pdfDoc);
          
          backPositions.push({
            job,
            pdfDoc: backPdfCopy, // Use a separate independent copy for the back
            page: pageCount > 1 ? 1 : 0, // Use page 1 if exists, otherwise page 0
            position: backPosition
          });
        }
        
        currentPosition++;
        if (currentPosition >= slotsPerSheet) {
          console.log(`Reached maximum slots (${slotsPerSheet}) - no more jobs can be added`);
          break;
        }
      } catch (error) {
        console.error(`Error creating PDF copy for job ${job.id}, copy ${copyNumber}:`, error);
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
 */
function calculateBackPosition(frontPosition: number, slotsPerSheet: number): number {
  // For a typical business card imposition sheet with 3 columns
  const columns = 3;
  const rows = Math.ceil(slotsPerSheet / columns);
  
  const row = Math.floor(frontPosition / columns);
  const col = frontPosition % columns;
  
  // For back sides, we need to mirror the column position
  // If front position is at column 0, back is at column 2
  // If front position is at column 1, back is at column 1
  // If front position is at column 2, back is at column 0
  const mirroredCol = columns - 1 - col;
  const backPosition = (row * columns) + mirroredCol;
  
  console.log(`MAPPING: Front position ${frontPosition} (row ${row}, col ${col}) maps to back position ${backPosition} (row ${row}, col ${mirroredCol})`);
  
  return backPosition;
}
