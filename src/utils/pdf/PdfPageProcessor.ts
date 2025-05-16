
import { PDFDocument } from "pdf-lib";
import { loadPdfAsBytes } from "./pdfLoaderCore";
import { createErrorPdf } from "./emptyPdfGenerator";
import { Job, LaminationType } from "@/components/batches/types/BatchTypes";

export interface ProcessedJobPages {
  jobId: string;
  jobName: string;
  frontPages: ArrayBuffer[];
  backPages: ArrayBuffer[];
  isDoubleSided: boolean;
  error?: string;
}

interface JobWithRequiredFields {
  id: string;
  name: string;
  pdf_url: string | null;
  double_sided?: boolean;
  file_name: string;
  uploaded_at: string;
  lamination_type: LaminationType;
}

// Function to ensure job has all required properties
function ensureRequiredFields(job: Job): JobWithRequiredFields {
  return {
    ...job,
    file_name: job.file_name || `job-${job.id.substring(0, 6)}.pdf`,
    uploaded_at: job.uploaded_at || new Date().toISOString(),
    lamination_type: job.lamination_type || "none" as LaminationType
  };
}

/**
 * Processes job PDFs to extract and duplicate pages based on slot requirements
 */
export async function processJobPdfs(
  jobs: Job[],
  jobSlotAllocations: { jobId: string; slotsNeeded: number; isDoubleSided: boolean }[]
): Promise<ProcessedJobPages[]> {
  console.log(`Processing PDFs for ${jobs.length} jobs`);
  
  const processedJobs: ProcessedJobPages[] = [];
  
  for (const job of jobs) {
    console.log(`Processing job "${job.name}" (${job.id})`);
    
    // Ensure job has all required fields
    const completeJob = ensureRequiredFields(job);
    
    // Find this job's allocation
    const allocation = jobSlotAllocations.find(alloc => alloc.jobId === completeJob.id);
    if (!allocation) {
      console.error(`No allocation found for job ${completeJob.id}`);
      continue;
    }
    
    try {
      // Load the PDF
      const pdfData = await loadPdfAsBytes(completeJob.pdf_url || "", completeJob.id);
      
      if (!pdfData || !pdfData.buffer) {
        throw new Error("Failed to load PDF");
      }
      
      const { buffer, pageCount } = pdfData;
      console.log(`Job ${completeJob.id} PDF loaded with ${pageCount} pages, buffer size: ${buffer.byteLength} bytes`);
      
      // Create processed job entry
      const processedJob: ProcessedJobPages = {
        jobId: completeJob.id,
        jobName: completeJob.name,
        frontPages: [],
        backPages: [],
        // Use double_sided property if available, otherwise infer from pageCount
        isDoubleSided: completeJob.double_sided !== undefined ? completeJob.double_sided : pageCount > 1
      };
      
      // Extract front and back pages
      if (pageCount === 0) {
        throw new Error("PDF has no pages");
      }
      
      try {
        // Load PDF document for page extraction
        const pdfDoc = await PDFDocument.load(buffer.slice(0)); // Create a copy of the buffer
        
        // For single-sided jobs or front pages of double-sided jobs
        if (pageCount >= 1) {
          // Extract and duplicate front page
          const frontPageBuffer = await extractAndDuplicatePage(pdfDoc, 0, allocation.slotsNeeded);
          if (frontPageBuffer) {
            processedJob.frontPages = new Array(allocation.slotsNeeded).fill(frontPageBuffer);
            console.log(`Created ${processedJob.frontPages.length} front page copies for job ${completeJob.id}, size: ${frontPageBuffer.byteLength} bytes`);
          } else {
            throw new Error("Failed to extract front page");
          }
        }
        
        // For double-sided jobs, extract back pages if available
        if (processedJob.isDoubleSided && pageCount >= 2) {
          // Extract and duplicate back page
          const backPageBuffer = await extractAndDuplicatePage(pdfDoc, 1, allocation.slotsNeeded);
          if (backPageBuffer) {
            processedJob.backPages = new Array(allocation.slotsNeeded).fill(backPageBuffer);
            console.log(`Created ${processedJob.backPages.length} back page copies for job ${completeJob.id}, size: ${backPageBuffer.byteLength} bytes`);
          } else {
            throw new Error("Failed to extract back page");
          }
        } else if (processedJob.isDoubleSided) {
          // Double-sided but missing back page
          console.warn(`Job ${completeJob.id} is marked as double-sided but PDF doesn't have a back page`);
          // Create an empty back page
          const emptyPdf = await createErrorPdf(completeJob, "Back side not provided");
          const emptyPdfBytes = await emptyPdf.save();
          processedJob.backPages = new Array(allocation.slotsNeeded).fill(emptyPdfBytes);
        }
      } catch (error) {
        console.error(`Error extracting pages from PDF for job ${completeJob.id}:`, error);
        throw error;
      }
      
      processedJobs.push(processedJob);
      
    } catch (error) {
      console.error(`Error processing PDF for job ${completeJob.id}:`, error);
      
      // Create error placeholder
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorPdf = await createErrorPdf(completeJob, errorMessage);
      const errorPdfBytes = await errorPdf.save();
      
      processedJobs.push({
        jobId: completeJob.id,
        jobName: completeJob.name,
        frontPages: new Array(allocation.slotsNeeded).fill(errorPdfBytes),
        backPages: allocation.isDoubleSided ? new Array(allocation.slotsNeeded).fill(errorPdfBytes) : [],
        isDoubleSided: allocation.isDoubleSided,
        error: errorMessage
      });
    }
  }
  
  return processedJobs;
}

/**
 * Extracts a page from a PDF and duplicates it into a standalone PDF
 */
async function extractAndDuplicatePage(
  sourcePdf: PDFDocument, 
  pageIndex: number,
  copies: number
): Promise<ArrayBuffer | null> {
  try {
    console.log(`Extracting page ${pageIndex} from PDF with ${sourcePdf.getPageCount()} pages`);
    
    if (pageIndex >= sourcePdf.getPageCount()) {
      console.error(`Page index ${pageIndex} is out of bounds`);
      return null;
    }
    
    // Create a new PDF with just the required page
    const extractedPdf = await PDFDocument.create();
    
    // Copy the page
    const [copiedPage] = await extractedPdf.copyPages(sourcePdf, [pageIndex]);
    extractedPdf.addPage(copiedPage);
    
    // Save it to bytes
    const pdfBytes = await extractedPdf.save();
    
    console.log(`Successfully extracted page ${pageIndex}, size: ${pdfBytes.byteLength} bytes`);
    
    return pdfBytes;
  } catch (error) {
    console.error(`Error extracting page ${pageIndex}:`, error);
    return null;
  }
}
