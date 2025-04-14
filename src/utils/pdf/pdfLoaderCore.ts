
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { fetchPdfWithRetry, loadPdfFromBytes } from "./pdfFetchHelper";
import { createEmptyPdf, createErrorPdf } from "./emptyPdfGenerator";

// Core function to load a single job PDF
export async function loadSingleJobPdf(job: Job, index: number): Promise<{ 
  job: Job; 
  pdfDoc: PDFDocument; 
  isDuplicated: boolean 
} | null> {
  try {
    if (!job.pdf_url) {
      console.log(`No PDF URL for job ${job.id || index}, creating empty PDF`);
      const emptyPdf = await createEmptyPdf(job);
      return { job, pdfDoc: emptyPdf, isDuplicated: false };
    }
    
    console.log(`Loading PDF for job ${job.id || index} from URL: ${job.pdf_url}`);
    
    // Fetch the PDF bytes
    const pdfBytes = await fetchPdfWithRetry(job.pdf_url, job.id || index.toString());
    if (!pdfBytes) {
      console.error(`Failed to fetch PDF for job ${job.id || index}`);
      const errorPdf = await createErrorPdf(job, "Failed to fetch PDF");
      return { job, pdfDoc: errorPdf, isDuplicated: false };
    }
    
    // Load the PDF document
    const pdfDoc = await loadPdfFromBytes(pdfBytes, job.id || index.toString());
    if (!pdfDoc) {
      console.error(`Failed to load PDF for job ${job.id || index}`);
      const errorPdf = await createErrorPdf(job, "Failed to parse PDF");
      return { job, pdfDoc: errorPdf, isDuplicated: false };
    }
    
    // Return the loaded PDF document
    return { job, pdfDoc, isDuplicated: false };
  } catch (error) {
    console.error(`Error loading PDF for job ${job.id || index}:`, error);
    
    try {
      const errorPdf = await createErrorPdf(job, error instanceof Error ? error.message : "Unknown error");
      return { job, pdfDoc: errorPdf, isDuplicated: false };
    } catch (fallbackError) {
      console.error(`Couldn't create fallback PDF for job ${job.id || index}:`, fallbackError);
      return null;
    }
  }
}

// Load a batch of PDFs with parallel processing
export async function loadMultipleJobPdfs(jobs: Job[]): Promise<Map<string, { 
  job: Job; 
  pdfDoc: PDFDocument 
}>> {
  console.log(`Loading PDFs for ${jobs.length} jobs`);
  const jobPDFs = new Map<string, { job: Job; pdfDoc: PDFDocument }>();
  
  // Process job PDFs in parallel for better performance
  const loadPromises = jobs.map(async (job) => {
    try {
      if (!job.pdf_url) {
        console.error(`Missing PDF URL for job ${job.id}`);
        const emptyPdf = await createEmptyPdf(job);
        return { id: job.id, result: { job, pdfDoc: emptyPdf } };
      }
      
      // Fetch and load PDF
      const pdfBytes = await fetchPdfWithRetry(job.pdf_url, job.id);
      if (!pdfBytes) {
        console.error(`Failed to fetch PDF for job ${job.id}`);
        const errorPdf = await createErrorPdf(job, "Failed to fetch PDF");
        return { id: job.id, result: { job, pdfDoc: errorPdf } };
      }
      
      const pdfDoc = await loadPdfFromBytes(pdfBytes, job.id);
      if (!pdfDoc) {
        console.error(`Failed to load PDF for job ${job.id}`);
        const errorPdf = await createErrorPdf(job, "Failed to parse PDF");
        return { id: job.id, result: { job, pdfDoc: errorPdf } };
      }
      
      return { id: job.id, result: { job, pdfDoc } };
    } catch (error) {
      console.error(`Error loading PDF for job ${job.id}:`, error);
      
      const errorPdf = await createErrorPdf(job, error instanceof Error ? error.message : "Unknown error");
      return { id: job.id, result: { job, pdfDoc: errorPdf } };
    }
  });
  
  const results = await Promise.all(loadPromises);
  
  // Populate the map with results
  results.forEach(({ id, result }) => {
    if (id && result) {
      jobPDFs.set(id, result);
    }
  });
  
  console.log(`Successfully loaded PDFs for ${jobPDFs.size} out of ${jobs.length} jobs`);
  return jobPDFs;
}
