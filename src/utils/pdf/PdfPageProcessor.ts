
import { PDFDocument } from "pdf-lib";
import { loadPdfAsBytes } from "./pdfLoaderCore";
import { createErrorPdf } from "./emptyPdfGenerator";
import { Job } from "@/components/business-cards/JobsTable";

export interface ProcessedJobPages {
  jobId: string;
  jobName: string;
  frontPages: ArrayBuffer[];
  backPages: ArrayBuffer[];
  isDoubleSided: boolean;
  error?: string;
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
    
    // Find this job's allocation
    const allocation = jobSlotAllocations.find(alloc => alloc.jobId === job.id);
    if (!allocation) {
      console.error(`No allocation found for job ${job.id}`);
      continue;
    }
    
    try {
      // Load the PDF
      const pdfData = await loadPdfAsBytes(job.pdf_url || "", job.id);
      
      if (!pdfData || !pdfData.buffer) {
        throw new Error("Failed to load PDF");
      }
      
      const { buffer, pageCount } = pdfData;
      console.log(`Job ${job.id} PDF loaded with ${pageCount} pages, buffer size: ${buffer.byteLength} bytes`);
      
      // Create processed job entry
      const processedJob: ProcessedJobPages = {
        jobId: job.id,
        jobName: job.name,
        frontPages: [],
        backPages: [],
        isDoubleSided: job.double_sided
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
            console.log(`Created ${processedJob.frontPages.length} front page copies for job ${job.id}, size: ${frontPageBuffer.byteLength} bytes`);
          } else {
            throw new Error("Failed to extract front page");
          }
        }
        
        // For double-sided jobs, extract back pages if available
        if (job.double_sided && pageCount >= 2) {
          // Extract and duplicate back page
          const backPageBuffer = await extractAndDuplicatePage(pdfDoc, 1, allocation.slotsNeeded);
          if (backPageBuffer) {
            processedJob.backPages = new Array(allocation.slotsNeeded).fill(backPageBuffer);
            console.log(`Created ${processedJob.backPages.length} back page copies for job ${job.id}, size: ${backPageBuffer.byteLength} bytes`);
          } else {
            throw new Error("Failed to extract back page");
          }
        } else if (job.double_sided) {
          // Double-sided but missing back page
          console.warn(`Job ${job.id} is marked as double-sided but PDF doesn't have a back page`);
          // Create an empty back page
          const emptyPdf = await createErrorPdf(job, "Back side not provided");
          const emptyPdfBytes = await emptyPdf.save();
          processedJob.backPages = new Array(allocation.slotsNeeded).fill(emptyPdfBytes);
        }
      } catch (error) {
        console.error(`Error extracting pages from PDF for job ${job.id}:`, error);
        throw error;
      }
      
      processedJobs.push(processedJob);
      
    } catch (error) {
      console.error(`Error processing PDF for job ${job.id}:`, error);
      
      // Create error placeholder
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorPdf = await createErrorPdf(job, errorMessage);
      const errorPdfBytes = await errorPdf.save();
      
      processedJobs.push({
        jobId: job.id,
        jobName: job.name,
        frontPages: new Array(allocation.slotsNeeded).fill(errorPdfBytes),
        backPages: job.double_sided ? new Array(allocation.slotsNeeded).fill(errorPdfBytes) : [],
        isDoubleSided: job.double_sided,
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
