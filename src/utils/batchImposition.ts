
import { Job } from "@/components/business-cards/JobsTable";
import { BaseJob } from "@/config/productTypes";
import { generateBatchImposition } from "./pdf/BatchPdfGenerator";

/**
 * Generates an imposition sheet for a batch of jobs
 */
export async function generateImpositionSheet(jobs: Job[] | BaseJob[], batchName: string = ""): Promise<Uint8Array> {
  console.log("Starting imposition sheet generation for batch:", batchName);
  
  try {
    // Validate input
    if (!jobs || jobs.length === 0) {
      console.error("No jobs provided for imposition sheet generation");
      throw new Error("No jobs provided for imposition sheet generation");
    }
    
    // Use provided batch name or generate default
    const actualBatchName = batchName || generateDefaultBatchName();
    
    // Generate imposition PDF using our new system
    return await generateBatchImposition(jobs as Job[], actualBatchName);
    
  } catch (error) {
    console.error("Error in generateImpositionSheet:", error);
    throw error;
  }
}

// Helper function for default batch name
function generateDefaultBatchName(): string {
  const today = new Date();
  const year = today.getFullYear().toString().slice(2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `DXB-BC-${year}${month}${day}`;
}
