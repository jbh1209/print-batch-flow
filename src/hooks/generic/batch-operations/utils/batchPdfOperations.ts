
import { BaseJob } from "@/config/productTypes";
import { generateAndUploadBatchPDFs } from "@/utils/batchPdfOperations";
import { checkBucketExists } from "@/utils/pdf/urlUtils";
import { toast } from "sonner";

/**
 * Generates PDFs for a batch of jobs
 */
export async function generateBatchPdfs(
  selectedJobs: BaseJob[], 
  batchName: string, 
  userId: string
): Promise<{ overviewUrl: string | null, impositionUrl: string | null }> {
  try {
    // Check if bucket exists before trying to create it
    const bucketExists = await checkBucketExists("pdf_files");
    console.log("pdf_files bucket exists:", bucketExists);
    
    // Generate and upload batch PDFs
    console.log("Generating batch PDFs for selected jobs...");
    const pdfUrls = await generateAndUploadBatchPDFs(selectedJobs, batchName, userId);
    console.log("Generated batch PDFs:", pdfUrls);
    return pdfUrls;
    
  } catch (pdfError) {
    console.error("Error generating batch PDFs:", pdfError);
    toast.error("Could not generate batch PDFs, but will continue with batch creation");
    // Return null URLs if generation fails
    return { overviewUrl: null, impositionUrl: null };
  }
}
