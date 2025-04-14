
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
  
  // Debug job IDs and PDF availability
  jobs.forEach(job => {
    console.log(`Job ${job.id} (${job.name}): PDF ${jobPDFs.has(job.id) ? 'available' : 'missing'}`);
  });
  
  // IMPORTANT: Process jobs in sequence instead of trying to fill slots as much as possible
  // This ensures we maintain job variety in the imposition
  let slotsRemaining = slotsPerSheet;
  let currentJobIndex = 0;
  
  // First pass: Add one of each job to ensure variety
  // This fixes the issue of only seeing the first PDF repeated
  for (let i = 0; i < jobs.length && frontPDFs.length < slotsPerSheet; i++) {
    const job = jobs[i];
    
    if (!jobPDFs.has(job.id)) {
      console.warn(`Skipping job ${job.id} due to missing PDF`);
      continue;
    }
    
    const { pdfDoc } = jobPDFs.get(job.id)!;
    const pageCount = pdfDoc.getPageCount();
    
    console.log(`Adding one copy of job ${job.id} (${job.name}) to ensure variety`);
    
    // Add one front page for this job
    frontPDFs.push({ 
      job, 
      pdfDoc,
      page: 0  // First page index
    });
    
    // Add back page if job is double-sided and has a second page
    if (job.double_sided && pageCount > 1) {
      backPDFs.push({ 
        job, 
        pdfDoc,
        page: 1  // Second page index
      });
    }
    
    slotsRemaining--;
    if (slotsRemaining <= 0) break;
  }
  
  // Second pass: Fill remaining slots proportionally based on quantity
  if (slotsRemaining > 0) {
    console.log(`After first pass: ${frontPDFs.length} slots used, ${slotsRemaining} remaining`);
    
    // Calculate total remaining quantity
    const totalRemainingQuantity = jobs.reduce((sum, job) => {
      const alreadyAdded = frontPDFs.filter(item => item.job.id === job.id).length;
      return sum + Math.max(0, (job.quantity || 1) - alreadyAdded);
    }, 0);
    
    console.log(`Total remaining quantity across all jobs: ${totalRemainingQuantity}`);
    
    // Distribute remaining slots proportionally
    for (const job of jobs) {
      if (!jobPDFs.has(job.id)) continue;
      
      const { pdfDoc } = jobPDFs.get(job.id)!;
      const pageCount = pdfDoc.getPageCount();
      
      // Count how many we've already added
      const alreadyAdded = frontPDFs.filter(item => item.job.id === job.id).length;
      
      // Calculate how many more we should add based on proportion
      const remainingForThisJob = Math.max(0, (job.quantity || 1) - alreadyAdded);
      const proportion = totalRemainingQuantity > 0 ? remainingForThisJob / totalRemainingQuantity : 0;
      let slotsForThisJob = Math.min(Math.round(proportion * slotsRemaining), remainingForThisJob);
      
      console.log(`Job ${job.id}: already added ${alreadyAdded}, adding ${slotsForThisJob} more`);
      
      // Add calculated number of slots for this job
      for (let i = 0; i < slotsForThisJob && slotsRemaining > 0; i++) {
        frontPDFs.push({ 
          job, 
          pdfDoc,
          page: 0 // First page index
        });
        
        // Add back page if job is double-sided and has a second page
        if (job.double_sided && pageCount > 1) {
          backPDFs.push({ 
            job, 
            pdfDoc,
            page: 1 // Second page index
          });
        }
        
        slotsRemaining--;
      }
    }
  }
  
  // If we still have slots remaining, fill them with jobs in sequence
  while (slotsRemaining > 0 && jobs.length > 0) {
    const jobIndex = currentJobIndex % jobs.length;
    const job = jobs[jobIndex];
    currentJobIndex++;
    
    if (!jobPDFs.has(job.id)) continue;
    
    const { pdfDoc } = jobPDFs.get(job.id)!;
    const pageCount = pdfDoc.getPageCount();
    
    frontPDFs.push({ 
      job, 
      pdfDoc,
      page: 0 // First page index
    });
    
    // Add back page if job is double-sided and has a second page
    if (job.double_sided && pageCount > 1) {
      backPDFs.push({ 
        job, 
        pdfDoc,
        page: 1 // Second page index
      });
    }
    
    slotsRemaining--;
  }
  
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
