
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
  
  const frontPDFs: { job: Job; pdfDoc: PDFDocument; page: number }[] = [];
  const backPDFs: { job: Job; pdfDoc: PDFDocument; page: number }[] = [];
  
  // Load all PDFs first using the specialized function
  const jobPDFs = await loadMultipleJobPdfs(jobs);
  console.log(`Successfully loaded PDFs for ${jobPDFs.size} out of ${jobs.length} jobs`);
  
  // Now, distribute the jobs across the slots based on quantity needed
  let remainingSlots = slotsPerSheet;
  let totalSlotsUsed = 0;
  
  // Process each job and add enough copies to the output arrays
  for (const job of jobs) {
    // Skip if we couldn't load a PDF for this job
    if (!jobPDFs.has(job.id)) {
      console.warn(`Skipping job ${job.id} due to missing PDF`);
      continue;
    }
    
    const { pdfDoc } = jobPDFs.get(job.id)!;
    const pageCount = pdfDoc.getPageCount();
    
    // Calculate how many slots this job requires (cap at remaining slots)
    const jobQuantity = job.quantity || 1;
    const slotsNeeded = Math.min(jobQuantity, remainingSlots);
    
    console.log(`Job ${job.id} needs ${slotsNeeded} out of ${jobQuantity} slots (${remainingSlots} slots remaining)`);
    
    if (slotsNeeded <= 0) {
      console.warn(`No slots available for job ${job.id}, will be excluded from sheet`);
      continue;
    }
    
    // Add front pages for this job
    for (let i = 0; i < slotsNeeded; i++) {
      frontPDFs.push({ 
        job, 
        pdfDoc,
        page: 0 // First page index
      });
      totalSlotsUsed++;
    }
    
    // Add back pages if job is double-sided and has a second page
    if (job.double_sided && pageCount > 1) {
      for (let i = 0; i < slotsNeeded; i++) {
        backPDFs.push({ 
          job, 
          pdfDoc,
          page: 1 // Second page index
        });
      }
    }
    
    // Update remaining slots
    remainingSlots -= slotsNeeded;
    
    if (remainingSlots <= 0) {
      console.log("All slots filled, stopping job distribution");
      break;
    }
  }
  
  console.log(`Created ${frontPDFs.length} front pages and ${backPDFs.length} back pages for imposition`);
  console.log(`Total slots used: ${totalSlotsUsed} out of ${slotsPerSheet}`);
  return { frontPDFs, backPDFs };
}
