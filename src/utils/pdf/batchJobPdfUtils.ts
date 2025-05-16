
import { PDFDocument } from "pdf-lib";
import { Job, LaminationType } from "@/components/batches/types/BatchTypes";
import { getSignedUrl } from "./signedUrlHelper";
import { createErrorPdf } from "./emptyPdfGenerator";
import { toast } from "sonner";
import { calculateJobPageDistribution } from "./JobPageDistributor";
import { convertToJobType } from "@/utils/typeAdapters";

// Constants
const TOTAL_SLOTS_PER_BATCH = 24;

interface JobWithRequiredFields {
  id: string;
  name: string;
  quantity: number;
  status: string;
  pdf_url: string | null;
  job_number: string;
  double_sided?: boolean;
  file_name: string;
  uploaded_at: string;
  lamination_type: LaminationType;
  due_date: string;
}

// Function to ensure job has all required properties
function ensureRequiredFields(job: Job): JobWithRequiredFields {
  return {
    ...job,
    file_name: job.file_name || `job-${job.id.substring(0, 6)}.pdf`,
    uploaded_at: job.uploaded_at || job.created_at || new Date().toISOString(),
    lamination_type: job.lamination_type || "none",
    due_date: job.due_date || new Date().toISOString()
  };
}

/**
 * Downloads all job PDFs in a batch as a single consolidated file
 * with copies based on slot allocation
 */
export async function downloadBatchJobPdfs(jobs: Job[], batchName: string): Promise<void> {
  try {
    toast.loading("Preparing batch job PDFs for download...");
    console.log(`Starting to download batch job PDFs for ${jobs.length} jobs`);
    
    // Ensure all jobs have the required properties
    const validatedJobs = jobs.map(job => ensureRequiredFields(job));
    
    // Generate consolidated PDF with multiple copies per job based on slot allocation
    const consolidatedPdf = await generateConsolidatedJobPdfs(validatedJobs);
    
    // Convert PDF to downloadable format
    const pdfBytes = await consolidatedPdf.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement("a");
    link.href = url;
    link.download = `${batchName}-jobs.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revoObjectURL(url), 100);
    toast.success("Batch job PDFs downloaded successfully");
  } catch (error) {
    console.error("Error downloading batch job PDFs:", error);
    toast.error(`Failed to download batch job PDFs: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Generates a consolidated PDF containing copies of each job PDF based on slot allocation
 */
async function generateConsolidatedJobPdfs(jobs: JobWithRequiredFields[]): Promise<PDFDocument> {
  // Create a new PDF document
  const consolidatedPdf = await PDFDocument.create();
  
  // Calculate job slot distribution 
  const jobDistribution = calculateSlotAllocation(jobs);
  
  // Track total slots used to determine if we need to add blank pages
  let totalSlotsUsed = 0;
  
  // Process each job PDF
  for (const job of jobs) {
    try {
      if (!job.pdf_url) {
        console.warn(`Job ${job.id} has no PDF URL`);
        continue;
      }
      
      // Get signed URL for PDF access
      const signedUrl = await getSignedUrl(job.pdf_url);
      if (!signedUrl) {
        console.error(`Failed to get signed URL for job ${job.id}`);
        continue;
      }
      
      // Fetch the PDF
      const response = await fetch(signedUrl);
      if (!response.ok) {
        console.error(`Failed to fetch PDF for job ${job.id}: ${response.status} ${response.statusText}`);
        continue;
      }
      
      // Get PDF bytes
      const pdfBytes = await response.arrayBuffer();
      
      // Load the PDF document
      const jobPdf = await PDFDocument.load(pdfBytes);
      
      // Get all pages from the job PDF
      const pageCount = jobPdf.getPageCount();
      
      // Determine if this is a single or double-sided job
      // Default to false if double_sided is not provided (for backward compatibility)
      const isDoubleSided = job.double_sided ?? (pageCount > 1);
      
      // Find this job's slot allocation from our calculation
      const jobAllocation = jobDistribution.find(j => j.jobId === job.id);
      if (!jobAllocation) {
        console.warn(`No slot allocation found for job ${job.id}`);
        continue;
      }
      
      // Get the number of slots allocated to this job
      const slotsAllocated = jobAllocation.slots;
      totalSlotsUsed += slotsAllocated;
      
      console.log(`Job ${job.name} (${job.id}): Allocated ${slotsAllocated} slots, is ${isDoubleSided ? 'double' : 'single'} sided`);
      
      // For each allocated slot, add the job pages
      for (let copy = 0; copy < slotsAllocated; copy++) {
        // Copy front page (which should always exist)
        if (pageCount > 0) {
          const [frontPage] = await consolidatedPdf.copyPages(jobPdf, [0]);
          consolidatedPdf.addPage(frontPage);
          
          // For single-sided jobs in a potential mixed batch, add a blank back page
          // This ensures proper pagination when printing double-sided
          if (!isDoubleSided) {
            const blankPage = consolidatedPdf.addPage([350, 200]); // Standard business card size
            blankPage.drawText("BLANK - SINGLE SIDED JOB", {
              x: 50,
              y: 100,
              size: 10,
              opacity: 0.5
            });
          }
        }
        
        // If double-sided, add the back page
        if (isDoubleSided && pageCount > 1) {
          const [backPage] = await consolidatedPdf.copyPages(jobPdf, [1]);
          consolidatedPdf.addPage(backPage);
        }
      }
      
      console.log(`Added ${slotsAllocated} copies of job ${job.name} (${pageCount} pages each)`);
      
    } catch (error) {
      console.error(`Error processing PDF for job ${job.id}:`, error);
      
      // Add error page for this job
      const errorPdf = await createErrorPdf(job, `Failed to process PDF: ${error}`);
      const [errorPage] = await consolidatedPdf.copyPages(errorPdf, [0]);
      consolidatedPdf.addPage(errorPage);
    }
  }
  
  // Check if we need to add blank pages to fill up to 24 slots
  const remainingSlots = TOTAL_SLOTS_PER_BATCH - totalSlotsUsed;
  if (remainingSlots > 0) {
    console.log(`Adding ${remainingSlots} blank slot pages to fill batch`);
    
    // Add blank pages for remaining slots (2 pages per slot - front and back)
    for (let i = 0; i < remainingSlots; i++) {
      // Add blank front page
      const blankFrontPage = consolidatedPdf.addPage([350, 200]); // Standard business card size
      blankFrontPage.drawText(`BLANK SLOT ${i+1}/${remainingSlots}`, {
        x: 50,
        y: 100,
        size: 12,
        opacity: 0.5
      });
      
      // Add blank back page
      const blankBackPage = consolidatedPdf.addPage([350, 200]);
      blankBackPage.drawText(`BLANK SLOT ${i+1}/${remainingSlots} (BACK)`, {
        x: 50,
        y: 100,
        size: 12,
        opacity: 0.5
      });
    }
  }
  
  // If no pages were added at all, add an error page
  if (consolidatedPdf.getPageCount() === 0) {
    const errorPdf = await PDFDocument.create();
    const page = errorPdf.addPage();
    
    page.drawText("No PDFs available for download", {
      x: 50,
      y: page.getHeight() - 100,
      size: 24
    });
    
    const [errorPage] = await consolidatedPdf.copyPages(errorPdf, [0]);
    consolidatedPdf.addPage(errorPage);
  }
  
  return consolidatedPdf;
}

/**
 * Calculates how many slots should be allocated to each job
 * based on quantity and ensuring the total is 24 slots
 */
function calculateSlotAllocation(jobs: JobWithRequiredFields[]): Array<{jobId: string, slots: number}> {
  // Get total quantity across all jobs
  const totalQuantity = jobs.reduce((sum, job) => sum + (job.quantity || 0), 0);
  
  if (totalQuantity === 0) {
    return jobs.map(job => ({ jobId: job.id, slots: 1 }));
  }
  
  // Calculate initial slot allocation based on job quantity proportion
  const initialAllocation = jobs.map(job => {
    const proportion = (job.quantity || 0) / totalQuantity;
    // Calculate slots as a proportion of 24 total slots
    const slots = Math.max(1, Math.round(proportion * TOTAL_SLOTS_PER_BATCH));
    return {
      jobId: job.id,
      jobName: job.name,
      quantity: job.quantity || 0,
      slots
    };
  });
  
  // Adjust allocation to ensure total = 24 slots
  let totalAllocatedSlots = initialAllocation.reduce((sum, job) => sum + job.slots, 0);
  
  // If we allocated more than 24 slots, reduce from largest jobs
  if (totalAllocatedSlots > TOTAL_SLOTS_PER_BATCH) {
    // Sort jobs by slots in descending order
    const sortedJobs = [...initialAllocation].sort((a, b) => b.slots - a.slots);
    
    // Reduce slots one by one from the largest jobs until we reach 24
    while (totalAllocatedSlots > TOTAL_SLOTS_PER_BATCH) {
      // Find the job with the most slots that has more than 1 slot
      const jobToReduce = sortedJobs.find(job => job.slots > 1);
      
      if (!jobToReduce) break; // Can't reduce anymore
      
      jobToReduce.slots -= 1;
      totalAllocatedSlots -= 1;
    }
  } 
  // If we allocated less than 24 slots, add to the largest jobs
  else if (totalAllocatedSlots < TOTAL_SLOTS_PER_BATCH) {
    // Sort jobs by quantity in descending order
    const sortedJobs = [...initialAllocation].sort((a, b) => b.quantity - a.quantity);
    
    // Add slots one by one to the largest jobs until we reach 24
    let index = 0;
    while (totalAllocatedSlots < TOTAL_SLOTS_PER_BATCH) {
      sortedJobs[index % sortedJobs.length].slots += 1;
      totalAllocatedSlots += 1;
      index++;
    }
  }
  
  // Return final allocation
  return initialAllocation.map(job => ({
    jobId: job.jobId,
    slots: job.slots
  }));
}
