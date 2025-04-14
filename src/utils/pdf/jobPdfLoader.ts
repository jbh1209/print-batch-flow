
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";

// Load all job PDFs with better error handling and logging
export async function loadJobPDFs(jobs: Job[], duplicateForImposition = false) {
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
      console.log(`Creating empty PDF for job ${job.id || "unknown"} (missing PDF URL)`);
      const emptyPdf = await PDFDocument.create();
      const page = emptyPdf.addPage([350, 200]);
      page.drawText(`No PDF available for job: ${job.name || job.id}`, {
        x: 50,
        y: 100,
        size: 12
      });
      return { job, pdfDoc: emptyPdf, isDuplicated: false };
    });

  // Load actual PDFs where URLs exist
  const jobPDFPromises = jobs.map(async (job, index) => {
    try {
      if (!job.pdf_url) {
        return null; // Will be handled by the empty PDF fallback
      }
      
      console.log(`Loading PDF for job ${job.id || index} from URL: ${job.pdf_url}`);
      
      // Fetch the PDF with better error handling
      try {
        // Add timestamp to URL to prevent caching
        const nocacheUrl = `${job.pdf_url}?nocache=${Date.now()}`;
        console.log(`Using URL with cache busting: ${nocacheUrl}`);
        
        // Fetch the PDF with cache busting
        const response = await fetch(nocacheUrl, { 
          cache: 'no-store', // Force fresh fetch
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/pdf',
            'Pragma': 'no-cache'
          }
        });
        
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
        
        try {
          const pdfDoc = await PDFDocument.load(pdfBytes, { 
            ignoreEncryption: true
          });
          
          const pageCount = pdfDoc.getPageCount();
          console.log(`PDF loaded with ${pageCount} pages for job ${job.id || index}`);
          
          if (pageCount === 0) {
            console.warn(`PDF has 0 pages for job ${job.id || index}`);
            return null;
          }
          
          // Return the loaded PDF document
          return { job, pdfDoc, isDuplicated: false };
        } catch (error) {
          console.error(`Error parsing PDF for job ${job.id || index}:`, error);
          return null;
        }
      } catch (error) {
        console.error(`Error fetching PDF for job ${job.id || index}:`, error);
        return null;
      }
    } catch (error) {
      console.error(`Error loading PDF for job ${job.id || index}:`, error);
      return null;
    }
  });
  
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
export async function createDuplicatedImpositionPDFs(jobs: Job[], quantity: number) {
  console.log(`Creating imposition PDFs for ${jobs.length} jobs with quantity ${quantity}...`);
  
  const frontPDFs: { job: Job; pdfDoc: PDFDocument; page: number }[] = [];
  const backPDFs: { job: Job; pdfDoc: PDFDocument; page: number }[] = [];
  
  // Process each job
  for (const job of jobs) {
    try {
      if (!job.pdf_url) {
        console.error(`Missing PDF URL for job ${job.id}`);
        // Create empty placeholder PDF for this job
        const emptyPdf = await PDFDocument.create();
        const page = emptyPdf.addPage([350, 200]);
        page.drawText(`No PDF available for job: ${job.name || job.id}`, {
          x: 50,
          y: 100,
          size: 12
        });
        
        // Add to front PDFs only
        frontPDFs.push({ 
          job, 
          pdfDoc: emptyPdf,
          page: 0
        });
        
        continue;
      }
      
      // Add timestamp to URL to prevent caching
      const nocacheUrl = `${job.pdf_url}?nocache=${Date.now()}`;
      console.log(`Using URL with cache busting: ${nocacheUrl}`);
      
      // Fetch with cache busting
      const response = await fetch(nocacheUrl, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/pdf',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch PDF for job ${job.id}: ${response.statusText} (${response.status})`);
        continue;
      }
      
      const pdfBytes = await response.arrayBuffer();
      if (!pdfBytes || pdfBytes.byteLength === 0) {
        console.error(`Empty PDF file received for job ${job.id}`);
        continue;
      }
      
      console.log(`Successfully fetched PDF for job ${job.id}, size: ${pdfBytes.byteLength} bytes`);
      
      const originalPdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true
      });
      
      const pageCount = originalPdfDoc.getPageCount();
      console.log(`PDF loaded with ${pageCount} pages for job ${job.id}`);
      
      // Skip jobs without PDFs
      if (pageCount === 0) {
        console.warn(`No pages found in PDF for job ${job.id}`);
        continue;
      }
      
      // Calculate how many copies of this job we need based on quantity
      // For business cards, typically 21 cards per sheet (3x7 grid)
      const copiesNeeded = Math.max(1, Math.ceil((job.quantity || 1) / 21));
      console.log(`Job ${job.id} needs ${copiesNeeded} copies for ${job.quantity || 0} cards`);
      
      // Add copies to the front and back arrays - THIS IS KEY FOR DUPLICATION
      for (let i = 0; i < copiesNeeded; i++) {
        // Front page (always the first page)
        frontPDFs.push({ 
          job, 
          pdfDoc: originalPdfDoc,
          page: 0 // First page index
        });
        
        // Back page (second page if available and job is double-sided)
        if (pageCount > 1 && job.double_sided) {
          backPDFs.push({ 
            job, 
            pdfDoc: originalPdfDoc,
            page: 1 // Second page index
          });
        }
      }
      
      // Log the current count of pages we're accumulating
      console.log(`Current counts - Front: ${frontPDFs.length}, Back: ${backPDFs.length}`);
    } catch (error) {
      console.error(`Error in PDF processing for job ${job.id}:`, error);
      // Create a fallback PDF for this job
      try {
        const fallbackPdf = await PDFDocument.create();
        const page = fallbackPdf.addPage([350, 200]);
        page.drawText(`Error loading PDF for: ${job.name || job.id}`, {
          x: 50,
          y: 100,
          size: 12
        });
        
        frontPDFs.push({ 
          job, 
          pdfDoc: fallbackPdf,
          page: 0
        });
      } catch (fallbackError) {
        console.error(`Couldn't even create fallback PDF for job ${job.id}:`, fallbackError);
      }
    }
  }
  
  console.log(`Created ${frontPDFs.length} front pages and ${backPDFs.length} back pages for imposition`);
  return { frontPDFs, backPDFs };
}
