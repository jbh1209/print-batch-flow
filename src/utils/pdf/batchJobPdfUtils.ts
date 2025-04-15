
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/batches/types/BatchTypes";
import { getSignedUrl } from "./signedUrlHelper";
import { createErrorPdf } from "./emptyPdfGenerator";
import { toast } from "sonner";

/**
 * Downloads all job PDFs in a batch as a single consolidated file
 * with multiple copies based on slot allocation
 */
export async function downloadBatchJobPdfs(jobs: Job[], batchName: string): Promise<void> {
  try {
    toast.loading("Preparing batch job PDFs for download...");
    
    // Generate consolidated PDF with multiple copies per job
    const consolidatedPdf = await generateConsolidatedJobPdfs(jobs);
    
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
    setTimeout(() => URL.revokeObjectURL(url), 100);
    toast.success("Batch job PDFs downloaded successfully");
  } catch (error) {
    console.error("Error downloading batch job PDFs:", error);
    toast.error("Failed to download batch job PDFs");
  }
}

/**
 * Generates a consolidated PDF containing multiple copies of each job PDF
 */
async function generateConsolidatedJobPdfs(jobs: Job[]): Promise<PDFDocument> {
  // Create a new PDF document
  const consolidatedPdf = await PDFDocument.create();
  
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
      
      // Determine number of copies based on job quantity
      // This is a simplification - in a real system you would get the actual slot allocation
      const copiesPerPage = getJobCopiesCount(job);
      
      // Get all pages from the job PDF
      const pageCount = jobPdf.getPageCount();
      
      // For each copy we need
      for (let copy = 0; copy < copiesPerPage; copy++) {
        // Copy all pages from job PDF to consolidated PDF
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
          const [copiedPage] = await consolidatedPdf.copyPages(jobPdf, [pageIndex]);
          consolidatedPdf.addPage(copiedPage);
        }
      }
      
      console.log(`Added ${copiesPerPage} copies of job ${job.name} (${pageCount} pages each)`);
      
    } catch (error) {
      console.error(`Error processing PDF for job ${job.id}:`, error);
      
      // Add error page for this job
      const errorPdf = await createErrorPdf(job as any, `Failed to process PDF: ${error}`);
      const [errorPage] = await consolidatedPdf.copyPages(errorPdf, [0]);
      consolidatedPdf.addPage(errorPage);
    }
  }
  
  // If no pages were added, add an error page
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
 * Determines how many copies of a job PDF should be included based on quantity
 */
function getJobCopiesCount(job: Job): number {
  // This is a simplified calculation - in production you would use the actual slot allocation
  // For now we'll use a simple calculation based on the job quantity
  // Business cards typically come in multiples of 50 or 100
  const baseQuantity = 100;
  
  // Calculate slots (we know each slot for business cards produces 100 cards)
  const slotsNeeded = Math.ceil(job.quantity / baseQuantity);
  
  // Return at least 1 copy
  return Math.max(1, slotsNeeded);
}
