
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BaseJob, ProductConfig, LaminationType, ExistingTableName } from "@/config/productTypes";
import { useAuth } from "@/hooks/useAuth";
import { generateBatchName } from "@/utils/batch/batchNameGenerator";
import { validateTableConfig } from "@/utils/batch/tableValidator";
import { 
  calculateSheetsRequired, 
  findEarliestDueDate, 
  extractCommonJobProperties,
  createBatchDataObject
} from "@/utils/batch/batchDataProcessor";
import { isExistingTable } from "@/utils/database/tableUtils";
import { processBatchJobs } from "@/utils/batch/batchJobProcessor";

export function useBatchCreation(productType: string, tableName: string) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { user } = useAuth();

  const createBatchWithSelectedJobs = async (
    selectedJobs: BaseJob[],
    config: ProductConfig,
    laminationType: LaminationType = "none",
    slaTargetDays?: number
  ) => {
    if (!user) {
      toast.error("User must be logged in to create batches");
      return null;
    }

    if (selectedJobs.length === 0) {
      toast.error("No jobs selected for batch creation");
      return null;
    }

    // Validate tableName before proceeding
    if (!validateTableConfig(tableName, productType)) {
      return null;
    }

    // Verify the table exists in our database before proceeding
    if (!isExistingTable(tableName)) {
      toast.error(`Invalid table name: ${tableName}`);
      return null;
    }
    
    setIsCreatingBatch(true);
    
    try {
      console.log(`Creating batch with ${selectedJobs.length} jobs for product type: ${productType} using table: ${tableName}`);
      console.log("Selected job IDs:", selectedJobs.map(job => job.id).join(", "));
      
      // Calculate sheets required
      const sheetsRequired = calculateSheetsRequired(selectedJobs);
      
      // Find the earliest due date among selected jobs
      const earliestDueDate = findEarliestDueDate(selectedJobs);
      
      // Get the correct SLA days for this product type
      const slaTarget = slaTargetDays || config.slaTargetDays || 3;
      
      // Get common properties from jobs for the batch
      const firstJob = selectedJobs[0];
      const { paperType } = extractCommonJobProperties(firstJob, config);
      
      // Generate batch name with standardized format
      const batchName = await generateBatchName(config.productType);
      
      console.log("Creating batch with name:", batchName);
      console.log("Batch data:", {
        paperType,
        laminationType,
        sheetsRequired,
        dueDate: earliestDueDate.toISOString(),
        slaTarget
      });
      
      // Create batch data object
      const batchData = createBatchDataObject(
        batchName,
        sheetsRequired,
        earliestDueDate,
        laminationType,
        paperType,
        user.id,
        slaTarget
      );
      
      // Create the batch record
      const { data: batch, error: batchError } = await supabase
        .from("batches")
        .insert(batchData)
        .select()
        .single();
        
      if (batchError) {
        console.error("Error creating batch:", batchError);
        throw batchError;
      }
      
      if (!batch) {
        throw new Error("Failed to create batch, returned data is empty");
      }
      
      console.log("Batch created successfully:", batch);
      
      // Extract the job IDs for processing
      const jobIds = selectedJobs.map(job => job.id);
      
      // Process the batch jobs with our new utility function
      const processResult = await processBatchJobs({
        jobIds,
        batchId: batch.id,
        tableName: tableName as ExistingTableName
      });
      
      // Report success or failure
      if (processResult.success) {
        toast.success(`Batch created with ${selectedJobs.length} jobs`);
        return batch;
      } else {
        // Try to delete the batch since jobs update failed
        await supabase.from("batches").delete().eq("id", batch.id);
        toast.error("Failed to link jobs to batch");
        return null;
      }
    } catch (error) {
      console.error("Error in batch creation:", error);
      toast.error("Failed to create batch: " + (error instanceof Error ? error.message : "Unknown error"));
      return null;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  return {
    createBatchWithSelectedJobs,
    isCreatingBatch,
    generateBatchName
  };
}
