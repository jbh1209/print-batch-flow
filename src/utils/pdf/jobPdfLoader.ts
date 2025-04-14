
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

// Generate duplicated PDF pages for imposition printing with improved handling
export async function createDuplicatedImpositionPDFs(jobs: Job[], slotsPerSheet: number) {
  console.log(`Creating imposition PDFs for ${jobs.length} jobs with ${slotsPerSheet} slots per sheet...`);
  
  const frontPDFs: { job: Job; pdfDoc: PDFDocument; page: number; position: number }[] = [];
  const backPDFs: { job: Job; pdfDoc: PDFDocument; page: number; position: number }[] = [];
  
  // Load all PDFs first using the specialized function
  const jobPDFs = await loadMultipleJobPdfs(jobs);
  console.log(`Successfully loaded PDFs for ${jobPDFs.size} out of ${jobs.length} jobs`);
  
  // Debug job IDs and PDF availability
  jobs.forEach(job => {
    console.log(`Job ${job.id} (${job.name}): PDF ${jobPDFs.has(job.id) ? 'available' : 'missing'}`);
  });
  
  // CRITICAL NEW IMPLEMENTATION: Process jobs in order of the provided jobs array
  // For each job, add all its copies consecutively
  let currentPosition = 0;
  
  // Iterate through jobs in the order they were provided
  for (const job of jobs) {
    if (!jobPDFs.has(job.id)) {
      console.warn(`Skipping job ${job.id} due to missing PDF`);
      continue;
    }
    
    const { pdfDoc } = jobPDFs.get(job.id)!;
    const pageCount = pdfDoc.getPageCount();
    
    // Calculate how many copies of this job we need
    const copiesToAdd = job.quantity || 1;
    console.log(`Adding ${copiesToAdd} copies of job ${job.id} (${job.name})`);
    
    // Add all copies of this job at once
    for (let i = 0; i < copiesToAdd && currentPosition < slotsPerSheet; i++) {
      // Add front page for this job copy
      frontPDFs.push({ 
        job, 
        pdfDoc,
        page: 0,  // First page index
        position: currentPosition  // Keep track of the position for back side alignment
      });
      
      // Add back page if job is double-sided and has a second page
      if (job.double_sided) {
        // CRITICAL: For double-sided cards, we need to flip the position for proper alignment
        // This ensures front left aligns with back right, etc.
        const backPosition = calculateBackPosition(currentPosition, slotsPerSheet);
        
        backPDFs.push({ 
          job, 
          pdfDoc,
          page: pageCount > 1 ? 1 : 0,  // Use second page if available, otherwise reuse first page
          position: backPosition  // Use the flipped position for back side
        });
      }
      
      currentPosition++;
      if (currentPosition >= slotsPerSheet) break;
    }
  }
  
  // Sort arrays by position to ensure correct placement
  frontPDFs.sort((a, b) => a.position - b.position);
  backPDFs.sort((a, b) => a.position - b.position);
  
  console.log(`Created ${frontPDFs.length} front pages and ${backPDFs.length} back pages for imposition`);
  
  // Debug final distribution
  const jobDistribution = new Map<string, number>();
  frontPDFs.forEach(item => {
    const jobId = item.job.id;
    jobDistribution.set(jobId, (jobDistribution.get(jobId) || 0) + 1);
  });
  
  console.log("Final job distribution:");
  jobDistribution.forEach((count, jobId) => {
    const job = jobs.find(j => j.id === jobId);
    console.log(`Job ${jobId} (${job?.name}): ${count} slots`);
  });
  
  return { frontPDFs, backPDFs };
}

// CRITICAL NEW FUNCTION: Calculate the corresponding position on the back side
// This ensures that when the paper is flipped, front and back align correctly
function calculateBackPosition(frontPosition: number, slotsPerSheet: number) {
  // For a 3x8 grid (24 slots), we need to:
  // 1. Determine the row (0-7)
  // 2. Determine the column (0-2)
  // 3. Calculate the flipped position
  
  const columns = 3; // Standard is 3 columns
  const rows = slotsPerSheet / columns; // Should be 8 rows for 24 slots
  
  const row = Math.floor(frontPosition / columns);
  const col = frontPosition % columns;
  
  // When flipping for double-sided printing:
  // - Same row
  // - Column becomes (columns - 1 - col)
  const flippedCol = (columns - 1) - col;
  const backPosition = (row * columns) + flippedCol;
  
  console.log(`Front position ${frontPosition} (row ${row}, col ${col}) maps to back position ${backPosition} (row ${row}, col ${flippedCol})`);
  
  return backPosition;
}
