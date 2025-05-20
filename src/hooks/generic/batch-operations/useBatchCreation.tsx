
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { BaseJob, ExistingTableName } from "@/config/productTypes";
import { LaminationType } from "@/config/types/productConfigTypes";
import { BatchCreationResult, BatchCreationConfig } from "./types/batchCreationTypes";
import { validateBatchCreationInputs } from "./utils/batchValidationUtils";
import { prepareBatchData } from "./utils/batchDataUtils";
import { 
  createBatchRecord, 
  updateJobsWithBatchId, 
  verifyBatchJobUpdates, 
  deleteBatch, 
  createBatchResult 
} from "./utils/batchDbOperations";
import { generateBatchPdfs } from "./utils/batchPdfOperations";
import { generateBatchName } from "@/utils/batch/batchNameGenerator";

export type { BatchCreationResult };

export function useBatchCreation(productType: string, tableName: string) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { user } = useAuth();

  const createBatchWithSelectedJobs = async (
    selectedJobs: BaseJob[],
    config: BatchCreationConfig,
    laminationType: LaminationType = "none",
    slaTargetDays?: number
  ): Promise<BatchCreationResult> => {
    // Validate inputs
    const validationResult = validateBatchCreationInputs(user, selectedJobs, tableName, productType);
    if (validationResult) return validationResult;

    setIsCreatingBatch(true);
    
    try {
      console.log(`Creating batch with ${selectedJobs.length} jobs for product type: ${productType} using table: ${tableName}`);
      
      // Get the correct SLA days for this product type
      const slaTarget = slaTargetDays || config.slaTargetDays || 3;
      
      // Generate and upload batch PDFs
      const pdfUrls = await generateBatchPdfs(selectedJobs, await generateBatchName(productType), user!.id);
      
      // Prepare batch data object
      const batchData = await prepareBatchData(
        selectedJobs,
        user!.id,
        productType,
        laminationType,
        slaTarget,
        pdfUrls
      );
      
      // Create the batch record
      const batch = await createBatchRecord(batchData);
      
      if (!batch) {
        throw new Error("Failed to create batch record");
      }
      
      // Extract all job IDs for the batch update
      const jobIds = selectedJobs.map(job => job.id);
      
      console.log(`Updating ${jobIds.length} jobs in table ${tableName} with batch id ${batch.id}`);
      
      // Using a validated table name that we confirmed is an existing table
      const validatedTableName = tableName as ExistingTableName;
      
      // Update jobs with batch ID
      const { error: updateError, data: updateData } = await updateJobsWithBatchId(
        validatedTableName,
        jobIds,
        batch.id
      );
      
      if (updateError) {
        console.error("Error updating jobs with batch ID:", updateError);
        
        // Try to roll back by deleting the batch since jobs update failed
        await deleteBatch(batch.id);
        
        throw new Error(`Failed to update jobs with batch ID: ${updateError.message}`);
      }
      
      // Verify the update results were successful
      let linkedCount = updateData?.length || 0;
      
      // If no update confirmation data returned, verify via query
      if (!updateData || !Array.isArray(updateData) || linkedCount === 0) {
        console.warn("No update confirmation data returned");
        
        try {
          // Perform a verification query to double check the update status
          linkedCount = await verifyBatchJobUpdates(validatedTableName, batch.id);
          
          // Check if verification found any jobs linked to this batch
          console.log(`Verification found ${linkedCount} jobs linked to batch ${batch.id}`);
          
          if (linkedCount === 0) {
            // No jobs found linked to this batch - attempt rollback
            console.error("No jobs were linked to the batch - performing rollback");
            await deleteBatch(batch.id);
            
            throw new Error("Failed to link any jobs to the batch");
          }
        } catch (verifyError) {
          console.error("Error during verification:", verifyError);
          // Continue with what we know
        }
      }
      
      // Check if all jobs were linked to the batch
      if (linkedCount < jobIds.length) {
        toast.warning(`Only ${linkedCount} of ${jobIds.length} jobs were linked to the batch`);
      } else {
        toast.success(`Batch created with all ${selectedJobs.length} jobs`);
      }
      
      return createBatchResult(
        true, 
        batch.id, 
        linkedCount,
        linkedCount < selectedJobs.length 
          ? `Only ${linkedCount} of ${selectedJobs.length} jobs were linked to the batch` 
          : undefined
      );
    } catch (error) {
      console.error("Error in batch creation:", error);
      toast.error("Failed to create batch: " + (error instanceof Error ? error.message : "Unknown error"));
      return createBatchResult(
        false, 
        null, 
        0,
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setIsCreatingBatch(false);
    }
  };

  return {
    createBatchWithSelectedJobs,
    isCreatingBatch,
    generateBatchName: () => generateBatchName(productType)
  };
}
