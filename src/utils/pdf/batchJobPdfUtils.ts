
import { toast } from "sonner";
import { getSignedUrl } from "./urlUtils";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Job } from "@/components/batches/types/BatchTypes";

/**
 * Downloads all job PDFs in a batch as a ZIP file
 */
export const downloadBatchJobPdfs = async (jobs: Job[], batchName: string): Promise<void> => {
  if (jobs.length === 0) {
    toast.error("No jobs available to download", {
      description: "This batch doesn't have any linked jobs"
    });
    return;
  }

  // Setup a loading toast with ID so we can update it
  const toastId = toast.loading(`Preparing ${jobs.length} PDFs for download...`);
  
  // Setup a timeout to update the toast if download takes too long
  const timeoutId = setTimeout(() => {
    toast.loading(`Still processing ${jobs.length} PDFs...`, { id: toastId });
  }, 5000);

  try {
    const zip = new JSZip();
    
    // Track the number of jobs with PDFs
    let jobsWithPdfs = 0;
    let jobsWithoutPdfs = 0;
    let failedJobs = 0;
    
    // Process jobs in chunks to avoid potential memory issues with large batches
    const chunkSize = 5;
    const jobChunks = [];
    
    for (let i = 0; i < jobs.length; i += chunkSize) {
      jobChunks.push(jobs.slice(i, i + chunkSize));
    }
    
    for (let i = 0; i < jobChunks.length; i++) {
      const chunk = jobChunks[i];
      
      // Update toast with progress
      if (i > 0) {
        toast.loading(`Processing PDFs ${i * chunkSize + 1}-${Math.min((i + 1) * chunkSize, jobs.length)} of ${jobs.length}...`, { id: toastId });
      }
      
      // Process each chunk of jobs in parallel
      await Promise.all(chunk.map(async (job) => {
        if (!job.pdf_url) {
          console.log(`Job ${job.name} has no PDF URL`);
          jobsWithoutPdfs++;
          return;
        }
        
        try {
          // Get signed URL if needed
          const url = await getSignedUrl(job.pdf_url);
          
          if (!url) {
            console.error(`Failed to get signed URL for job ${job.name}`);
            jobsWithoutPdfs++;
            return;
          }
          
          // Download PDF data with timeout and retry logic
          const maxRetries = 2;
          let retryCount = 0;
          let pdfData: Blob | null = null;
          
          while (retryCount <= maxRetries && !pdfData) {
            try {
              // Set up fetch with timeout
              const controller = new AbortController();
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Download timed out")), 15000)
              );
              
              const fetchPromise = fetch(url, { signal: controller.signal });
              
              // Race fetch against timeout
              const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
              
              if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
              }
              
              pdfData = await response.blob();
              
              if (pdfData.size === 0) {
                throw new Error("Downloaded PDF is empty");
              }
              
              // If we got here, we have valid PDF data
              break;
            } catch (downloadError) {
              console.error(`Error downloading PDF for job ${job.name} (attempt ${retryCount + 1}):`, downloadError);
              retryCount++;
              
              // If we've exhausted retries, mark this job as failed
              if (retryCount > maxRetries) {
                failedJobs++;
                return;
              }
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (!pdfData) {
            throw new Error("Failed to download PDF after retries");
          }
          
          // Sanitize filename to remove invalid characters
          const safeName = job.name.replace(/[/\\?%*:|"<>]/g, '-');
          
          // Add to ZIP
          zip.file(`${safeName}.pdf`, pdfData);
          jobsWithPdfs++;
        } catch (error) {
          console.error(`Error processing PDF for job ${job.name}:`, error);
          failedJobs++;
        }
      }));
    }
    
    // Clear timeout
    clearTimeout(timeoutId);
    
    if (jobsWithPdfs === 0) {
      toast.error("No PDFs could be downloaded", { 
        id: toastId,
        description: "None of the jobs had accessible PDF files"
      });
      return;
    }
    
    // Update toast with generating ZIP message
    toast.loading("Generating ZIP file...", { id: toastId });
    
    // Generate ZIP and trigger download
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `${batchName}-job-pdfs.zip`);
    
    // Show summary toast
    const message = jobsWithoutPdfs > 0 || failedJobs > 0
      ? `Downloaded ${jobsWithPdfs} PDFs. ${jobsWithoutPdfs} jobs had no PDFs available. ${failedJobs} downloads failed.`
      : `Successfully downloaded all ${jobsWithPdfs} PDFs.`;
    
    toast.success("Download complete", { 
      id: toastId,
      description: message
    });
  } catch (error) {
    // Clear timeout
    clearTimeout(timeoutId);
    
    console.error("Error downloading batch job PDFs:", error);
    toast.error("Failed to download job PDFs", { id: toastId });
  }
};
