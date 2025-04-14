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

export async function createDuplicatedImpositionPDFs(jobs: Job[], slotsPerSheet: number) {
  console.log(`Creating imposition PDFs for ${jobs.length} jobs with ${slotsPerSheet} slots per sheet...`);
  
  const frontPDFs: { job: Job; pdfDoc: PDFDocument; page: number; position: number }[] = [];
  const backPDFs: { job: Job; pdfDoc: PDFDocument; page: number; position: number }[] = [];
  
  // Load all PDFs first
  const jobPDFs = await loadMultipleJobPdfs(jobs);
  console.log(`Successfully loaded PDFs for ${jobPDFs.size} out of ${jobs.length} jobs`);
  
  // Debug logging for quantities
  jobs.forEach(job => {
    console.log(`Job ${job.id} (${job.name}): Quantity ${job.quantity || 1}`);
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
    
    console.log(`Processing job ${job.id} (${job.name}) - Quantity: ${quantity}`);
    
    // Add copies based on quantity
    for (let i = 0; i < quantity && currentPosition < slotsPerSheet; i++) {
      console.log(`Adding copy ${i + 1}/${quantity} of job ${job.id} at position ${currentPosition}`);
      
      // Add front page with PDF content
      frontPDFs.push({
        job,
        pdfDoc: jobData.pdfDoc,
        page: 0, // Front is always page 0
        position: currentPosition
      });
      
      // Add back page if double-sided
      if (job.double_sided) {
        const backPosition = calculateBackPosition(currentPosition, slotsPerSheet);
        console.log(`Adding back page for job ${job.id} at position ${backPosition}`);
        
        backPDFs.push({
          job,
          pdfDoc: jobData.pdfDoc,
          page: jobData.pdfDoc.getPageCount() > 1 ? 1 : 0, // Use page 1 if exists, otherwise page 0
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
  frontPDFs.sort((a, b) => a.position - b.position);
  backPDFs.sort((a, b) => a.position - b.position);
  
  console.log("\nFinal front PDF positions:");
  frontPDFs.forEach((pdf) => {
    console.log(`Position ${pdf.position}: Job ${pdf.job.id} (${pdf.job.name}) - Page ${pdf.page}`);
  });
  
  console.log("\nFinal back PDF positions:");
  backPDFs.forEach((pdf) => {
    console.log(`Position ${pdf.position}: Job ${pdf.job.id} (${pdf.job.name}) - Page ${pdf.page}`);
  });
  
  return { frontPDFs, backPDFs };
}

// Calculate the corresponding position on the back side
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
