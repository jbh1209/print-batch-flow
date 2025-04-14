
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";

// Load all job PDFs with better error handling and logging
export async function loadJobPDFs(jobs: Job[], duplicateForImposition = false) {
  console.log(`Starting to load ${jobs.length} job PDFs...`);
  
  const jobPDFs = await Promise.all(jobs.map(async (job, index) => {
    try {
      console.log(`Loading PDF for job ${job.id || index} from URL: ${job.pdf_url}`);
      
      if (!job.pdf_url) {
        console.error(`Missing PDF URL for job ${job.id || index}`);
        return null;
      }
      
      const response = await fetch(job.pdf_url);
      if (!response.ok) {
        console.error(`Failed to fetch PDF for job ${job.id || index}: ${response.statusText} (${response.status})`);
        return null;
      }
      
      const pdfBytes = await response.arrayBuffer();
      if (!pdfBytes || pdfBytes.byteLength === 0) {
        console.error(`Empty PDF file received for job ${job.id || index}`);
        return null;
      }
      
      console.log(`Successfully fetched PDF for job ${job.id || index}, size: ${pdfBytes.byteLength} bytes`);
      
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();
      console.log(`PDF loaded with ${pageCount} pages for job ${job.id || index}`);
      
      // If we need to duplicate pages for imposition (front/back printing)
      if (duplicateForImposition && pageCount > 1) {
        // Create a new document with duplicated pages in the correct order
        return { job, pdfDoc, isDuplicated: true };
      } else {
        return { job, pdfDoc, isDuplicated: false };
      }
    } catch (error) {
      console.error(`Error loading PDF for job ${job.id || index}:`, error);
      return null;
    }
  }));
  
  // Filter out any failed PDF loads
  const validPDFs = jobPDFs.filter(item => item !== null) as { 
    job: Job; 
    pdfDoc: PDFDocument; 
    isDuplicated: boolean;
  }[];
  
  console.log(`Successfully loaded ${validPDFs.length} out of ${jobs.length} PDFs`);
  return validPDFs;
}

// Generate duplicated PDF pages for imposition printing with improved handling
export async function createDuplicatedImpositionPDFs(jobs: Job[], quantity: number) {
  console.log(`Creating imposition PDFs for ${jobs.length} jobs with quantity ${quantity}...`);
  
  const frontPDFs: { job: Job; pdfDoc: PDFDocument; page: number }[] = [];
  const backPDFs: { job: Job; pdfDoc: PDFDocument; page: number }[] = [];
  
  for (const job of jobs) {
    try {
      if (!job.pdf_url) {
        console.error(`Missing PDF URL for job ${job.id}`);
        continue;
      }
      
      console.log(`Processing PDF for job ${job.id} from URL: ${job.pdf_url}`);
      
      // Fetch and load the original PDF
      const response = await fetch(job.pdf_url);
      if (!response.ok) {
        console.error(`Failed to fetch PDF for job ${job.id}: ${response.statusText} (${response.status})`);
        continue;
      }
      
      const pdfBytes = await response.arrayBuffer();
      if (!pdfBytes || pdfBytes.byteLength === 0) {
        console.error(`Empty PDF file received for job ${job.id}`);
        continue;
      }
      
      try {
        const originalPdfDoc = await PDFDocument.load(pdfBytes);
        const pageCount = originalPdfDoc.getPageCount();
        console.log(`PDF loaded with ${pageCount} pages for job ${job.id}`);
        
        // Skip jobs without PDFs
        if (pageCount === 0) {
          console.warn(`No pages found in PDF for job ${job.id}`);
          continue;
        }
        
        // Calculate how many copies of this job we need based on quantity
        // For business cards, typically 24 cards per sheet (3x8 grid)
        const copiesNeeded = Math.max(1, Math.ceil((job.quantity || 1) / 24));
        console.log(`Job ${job.id} needs ${copiesNeeded} copies for ${job.quantity || 0} cards`);
        
        // Add copies to the front and back arrays
        for (let i = 0; i < copiesNeeded; i++) {
          // Front page (always the first page)
          frontPDFs.push({ 
            job, 
            pdfDoc: originalPdfDoc,
            page: 0 // First page index
          });
          
          // Back page (second page if available)
          if (pageCount > 1) {
            backPDFs.push({ 
              job, 
              pdfDoc: originalPdfDoc,
              page: 1 // Second page index
            });
          }
        }
      } catch (error) {
        console.error(`Error processing PDF document for job ${job.id}:`, error);
        continue;
      }
    } catch (error) {
      console.error(`Error in PDF processing loop for job ${job.id}:`, error);
    }
  }
  
  console.log(`Created ${frontPDFs.length} front pages and ${backPDFs.length} back pages for imposition`);
  return { frontPDFs, backPDFs };
}
