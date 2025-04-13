
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";

// Load all job PDFs with support for multi-page handling and duplication
export async function loadJobPDFs(jobs: Job[], duplicateForImposition = false) {
  const jobPDFs = await Promise.all(jobs.map(async (job) => {
    try {
      const response = await fetch(job.pdf_url);
      if (!response.ok) {
        console.error(`Failed to fetch PDF for job ${job.id}: ${response.statusText}`);
        return null;
      }
      const pdfBytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // If we need to duplicate pages for imposition (front/back printing)
      if (duplicateForImposition && pdfDoc.getPageCount() > 1) {
        // Create a new document with duplicated pages in the correct order
        return { job, pdfDoc, isDuplicated: true };
      } else {
        return { job, pdfDoc, isDuplicated: false };
      }
    } catch (error) {
      console.error(`Error loading PDF for job ${job.id}:`, error);
      return null;
    }
  }));
  
  // Filter out any failed PDF loads
  return jobPDFs.filter(item => item !== null) as { 
    job: Job; 
    pdfDoc: PDFDocument; 
    isDuplicated: boolean;
  }[];
}

// Generate duplicated PDF pages for imposition printing
export async function createDuplicatedImpositionPDFs(jobs: Job[], quantity: number) {
  const frontPDFs: { job: Job; pdfDoc: PDFDocument; page: number }[] = [];
  const backPDFs: { job: Job; pdfDoc: PDFDocument; page: number }[] = [];
  
  await Promise.all(jobs.map(async (job) => {
    try {
      // Fetch and load the original PDF
      const response = await fetch(job.pdf_url);
      if (!response.ok) return;
      
      const pdfBytes = await response.arrayBuffer();
      const originalPdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = originalPdfDoc.getPageCount();
      
      // Skip jobs without PDFs or with only one page when we need front/back
      if (pageCount === 0) return;
      
      // Calculate how many copies of this job we need based on quantity
      // For business cards, typically 24 cards per sheet (3x8 grid)
      const copiesNeeded = Math.ceil(job.quantity / 24);
      
      // Add copies to the front and back arrays
      for (let i = 0; i < copiesNeeded; i++) {
        // Front page (always the first page)
        frontPDFs.push({ 
          job, 
          pdfDoc: originalPdfDoc,
          page: 0 // First page index
        });
        
        // Back page (second page if available, otherwise null)
        if (pageCount > 1) {
          backPDFs.push({ 
            job, 
            pdfDoc: originalPdfDoc,
            page: 1 // Second page index
          });
        }
      }
    } catch (error) {
      console.error(`Error processing PDF for job ${job.id}:`, error);
    }
  }));
  
  return { frontPDFs, backPDFs };
}
