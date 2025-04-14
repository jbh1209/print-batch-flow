import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { supabase } from "@/integrations/supabase/client";

// Helper function to get a signed URL for a storage object
async function getSignedUrl(url: string): Promise<string> {
  try {
    if (!url) return '';
    
    // Extract the bucket and file path from the URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Look for bucket name (typically "pdf_files" or other bucket name)
    const bucketIndex = pathParts.findIndex(part => 
      part === 'pdf_files' || 
      part === 'batches' || 
      part.includes('_files')
    );
    
    if (bucketIndex === -1) {
      console.warn('Could not identify bucket in URL:', url);
      return url; // Return original URL if we can't parse it
    }
    
    const bucket = pathParts[bucketIndex];
    
    // Get file path - everything after the bucket name
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    console.log(`Creating signed URL for bucket: ${bucket}, file: ${filePath}`);
    
    // Create a signed URL with one hour expiry
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600, {
        download: true // Force download header for proper content type
      });
    
    if (error) {
      console.error('Error getting signed URL:', error);
      throw error;
    }
    
    console.log('Got signed URL successfully:', data.signedUrl.substring(0, 50) + '...');
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return url; // Fall back to original URL in case of errors
  }
}

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
      
      // Get a signed URL for the file instead of using the public URL directly
      const signedUrl = await getSignedUrl(job.pdf_url);
      console.log(`Using signed URL for job ${job.id || index}`);
      
      // Fetch the PDF with better error handling
      try {
        // Add timestamp to prevent caching
        const nocacheUrl = `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}nocache=${Date.now()}`;
        console.log(`Using URL with cache busting: ${nocacheUrl.substring(0, 50)}...`);
        
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
export async function createDuplicatedImpositionPDFs(jobs: Job[], slotsPerSheet: number) {
  console.log(`Creating imposition PDFs for ${jobs.length} jobs with ${slotsPerSheet} slots per sheet...`);
  
  const frontPDFs: { job: Job; pdfDoc: PDFDocument; page: number }[] = [];
  const backPDFs: { job: Job; pdfDoc: PDFDocument; page: number }[] = [];
  
  // First, create a mapping of jobs to their loaded PDFs
  const jobPDFs = new Map<string, { job: Job; pdfDoc: PDFDocument }>();
  
  // Load all PDFs first - critical for different cards to show up
  console.log("Loading all job PDFs first...");
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
        
        jobPDFs.set(job.id, { job, pdfDoc: emptyPdf });
        continue;
      }
      
      // Get a signed URL for the file instead of using the public URL directly
      const signedUrl = await getSignedUrl(job.pdf_url);
      console.log(`Using signed URL for job ${job.id}`);
      
      // Add timestamp to prevent caching
      const nocacheUrl = `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}nocache=${Date.now()}`;
      
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
      
      // Store the loaded PDF in our map
      jobPDFs.set(job.id, { job, pdfDoc: originalPdfDoc });
    } catch (error) {
      console.error(`Error loading PDF for job ${job.id}:`, error);
      
      // Create a fallback PDF
      try {
        const fallbackPdf = await PDFDocument.create();
        const page = fallbackPdf.addPage([350, 200]);
        page.drawText(`Error loading PDF for: ${job.name || job.id}`, {
          x: 50,
          y: 100,
          size: 12
        });
        
        jobPDFs.set(job.id, { job, pdfDoc: fallbackPdf });
      } catch (fallbackError) {
        console.error(`Couldn't create fallback PDF for job ${job.id}:`, fallbackError);
      }
    }
  }
  
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
