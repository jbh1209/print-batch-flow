
import { PDFDocument } from "pdf-lib";
import { Job as BusinessCardJob } from "@/components/business-cards/JobsTable";
import { BaseJob } from "@/config/productTypes";
import { Job as BatchJob } from "@/components/batches/types/BatchTypes"; 
import { calculateJobPageDistribution } from "./JobPageDistributor";
import { processJobPdfs } from "./PdfPageProcessor";
import { toast } from "sonner";

/**
 * Interface for the result of generating batch job PDFs
 */
interface BatchJobPdfResult {
  pdfBytes: Uint8Array;
  jobCount: number;
  pageCount: number;
  errorCount: number;
}

/**
 * Type guard to check if a job is from the BusinessCardJob type
 */
function isBusinessCardJob(job: any): job is BusinessCardJob {
  return typeof job.double_sided !== 'undefined';
}

/**
 * Generates a combined PDF for all jobs in a batch, with proper page duplication
 * based on quantity and double-sided settings.
 */
export async function generateBatchJobPdf(
  jobs: BusinessCardJob[] | BatchJob[] | BaseJob[],
  batchName: string
): Promise<BatchJobPdfResult> {
  console.log(`Generating consolidated PDF for ${jobs.length} jobs in batch ${batchName}`);
  
  if (!jobs || jobs.length === 0) {
    console.error("No jobs provided for PDF generation");
    throw new Error("No jobs provided for PDF generation");
  }
  
  try {
    // Log all jobs to debug double_sided property
    jobs.forEach((job, index) => {
      console.log(`Job ${index + 1}: ${job.name} (${job.id}) - Double-sided: ${job.double_sided === true ? 'Yes' : 'No'}`);
    });
    
    // Convert incoming jobs to ensure compatibility with BusinessCardJob format
    // which is what our PDF processors expect
    const processableJobs = jobs.map(job => {
      // Add default double_sided property if it doesn't exist
      if (typeof job.double_sided === 'undefined') {
        console.log(`Job ${job.name} missing double_sided property, defaulting to false`);
        return {
          ...job,
          double_sided: false,
          // Ensure lamination_type is compatible with expected enum
          lamination_type: job.lamination_type as any
        };
      }
      console.log(`Job ${job.name} has double_sided = ${job.double_sided}`);
      return job;
    }) as BusinessCardJob[];
    
    // Step 1: Calculate job distribution (how many slots/copies per job)
    const TOTAL_SLOTS = 24; // 3x8 grid standard
    const jobAllocations = calculateJobPageDistribution(processableJobs, TOTAL_SLOTS);
    
    // Create map for quantity lookup
    const quantityMap = new Map(
      jobAllocations.map(job => [job.jobId, job.quantityPerSlot])
    );
    
    // Step 2: Process all job PDFs - extract and duplicate pages as needed
    const slotRequirements = jobAllocations.map(job => ({
      jobId: job.jobId,
      slotsNeeded: job.slotsNeeded,
      isDoubleSided: job.isDoubleSided
    }));
    
    // Process the job PDFs to get pages
    const processedJobPages = await processJobPdfs(processableJobs, slotRequirements);
    
    console.log(`Processed ${processedJobPages.length} job PDFs with their page allocations`);
    
    // Step 3: Create consolidated PDF with all pages
    const finalPdf = await PDFDocument.create();
    let totalPages = 0;
    let errorCount = 0;
    
    // Add all front pages first
    for (const jobPages of processedJobPages) {
      const frontCopies = Math.max(1, jobPages.frontPages.length);
      console.log(`Adding ${frontCopies} front page copies for job ${jobPages.jobName} (double-sided: ${jobPages.isDoubleSided})`);
      
      try {
        // Add front pages
        for (const frontPage of jobPages.frontPages) {
          // Load page from buffer
          const frontDoc = await PDFDocument.load(frontPage);
          const [copyPage] = await finalPdf.copyPages(frontDoc, [0]);
          finalPdf.addPage(copyPage);
          totalPages++;
        }
        
      } catch (error) {
        console.error(`Error adding front pages for job ${jobPages.jobId}:`, error);
        errorCount++;
        
        // Create an error page if we couldn't add the job pages
        const errorPage = finalPdf.addPage();
        const { width, height } = errorPage.getSize();
        errorPage.drawText(`Error: Failed to process job ${jobPages.jobName}`, {
          x: 50,
          y: height - 50,
          size: 12
        });
        totalPages++;
      }
    }
    
    // Add all back pages (if any)
    for (const jobPages of processedJobPages) {
      if (jobPages.isDoubleSided && jobPages.backPages.length > 0) {
        const backCopies = jobPages.backPages.length;
        console.log(`Adding ${backCopies} back page copies for job ${jobPages.jobName}`);
        
        try {
          // Add back pages
          for (const backPage of jobPages.backPages) {
            // Load page from buffer
            const backDoc = await PDFDocument.load(backPage);
            // FIXED: The issue was here - we were incorrectly copying pages from backDoc to backDoc
            // Instead, we should copy pages from backDoc to finalPdf
            const [copyPage] = await finalPdf.copyPages(backDoc, [0]);
            finalPdf.addPage(copyPage);
            totalPages++;
          }
        } catch (error) {
          console.error(`Error adding back pages for job ${jobPages.jobId}:`, error);
          errorCount++;
          
          // Create an error page if we couldn't add the job pages
          const errorPage = finalPdf.addPage();
          const { width, height } = errorPage.getSize();
          errorPage.drawText(`Error: Failed to process back side for job ${jobPages.jobName}`, {
            x: 50,
            y: height - 50,
            size: 12
          });
          totalPages++;
        }
      }
    }
    
    // Save the final PDF
    const pdfBytes = await finalPdf.save();
    
    console.log(`Final PDF generated with ${totalPages} total pages`);
    
    return {
      pdfBytes,
      jobCount: jobs.length,
      pageCount: totalPages,
      errorCount
    };
    
  } catch (error) {
    console.error("Error generating batch job PDF:", error);
    throw error;
  }
}
